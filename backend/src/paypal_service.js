import crypto from 'node:crypto';
import { cancelAppointmentForFailedPayment, expireStalePendingPayments } from './appointment_service.js';
import { config } from './config.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { classifyPayPalWebhook, validatePayableAppointment } from './payment_policy.js';

const paypalBaseUrl = config.paypalMode === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function requirePaymentConfig() {
  if (!hasSupabaseConfig) {
    return { ok: false, status: 503, data: { message: 'Backend chua cau hinh Supabase.' } };
  }
  if (!config.paypalClientId || !config.paypalClientSecret) {
    return { ok: false, status: 503, data: { message: 'Backend chua cau hinh PayPal.' } };
  }
  if (config.paypalCurrency !== 'USD' || !Number.isFinite(config.paypalVndToUsdRate) || config.paypalVndToUsdRate <= 0) {
    return { ok: false, status: 503, data: { message: 'Cấu hình quy đổi thanh toán PayPal chưa hợp lệ.' } };
  }
  if (!['sandbox', 'live'].includes(config.paypalMode)) {
    return { ok: false, status: 503, data: { message: 'PAYPAL_MODE phải là sandbox hoặc live.' } };
  }
  if (process.env.NODE_ENV === 'production') {
    try {
      const returnUrl = new URL(config.paypalReturnUrl);
      const cancelUrl = new URL(config.paypalCancelUrl);
      const frontendUrl = new URL(config.frontendUrl);
      if ([returnUrl, cancelUrl, frontendUrl].some(url => url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error();
      if (returnUrl.pathname !== '/api/payments/paypal/return' || cancelUrl.pathname !== '/api/payments/paypal/cancel') throw new Error();
    } catch {
      return { ok: false, status: 503, data: { message: 'PayPal cần URL HTTPS công khai cho return, cancel và frontend khi chạy production.' } };
    }
  }
  return { ok: true };
}

function receiptNumber() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `MHR${date}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function paypalAmountFromVnd(vndAmount) {
  const rate = Number(config.paypalVndToUsdRate || 25000);
  return (Math.max(Number(vndAmount) || 0, 0) / rate).toFixed(2);
}

function withQueryParams(url, params = {}) {
  const target = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, value);
  });
  return target.toString();
}

function paymentTokenSecret() {
  return config.jwtSecret || config.paypalClientSecret;
}

function signPaymentToken(appointmentId) {
  return crypto.createHmac('sha256', paymentTokenSecret()).update(String(appointmentId || '')).digest('hex');
}

function isValidPaymentToken(appointmentId, token) {
  if (!appointmentId || !token) return false;
  const expected = signPaymentToken(appointmentId);
  const actualBuffer = Buffer.from(String(token), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function paypalFetch(path, options = {}) {
  const response = await fetch(`${paypalBaseUrl}${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error_description || data.name || 'PayPal request failed.');
  }
  return data;
}

async function getAccessToken() {
  const credentials = Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString('base64');
  const data = await paypalFetch('/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  return data.access_token;
}

async function getAppointmentForPayment(appointmentId, ownerProfileId) {
  if (!appointmentId || !ownerProfileId) return null;
  const { data, error } = await supabase
    .from('appointments')
    .select('id, owner_profile_id, final_amount, deposit_amount, payment_status, status')
    .eq('id', appointmentId)
    .eq('owner_profile_id', ownerProfileId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertPendingPayment({ appointment, paypalOrder }) {
  const paymentRow = {
    appointment_id: appointment.id,
    owner_profile_id: appointment.owner_profile_id,
    amount: appointment.deposit_amount,
    currency: 'VND',
    method: 'paypal',
    status: 'pending',
    provider: 'paypal',
    paypal_order_id: paypalOrder.id,
    transaction_code: paypalOrder.id,
    receipt_number: receiptNumber(),
    raw_payload: paypalOrder,
  };

  const { data: existing, error: lookupError } = await supabase
    .from('payments')
    .select('id')
    .eq('paypal_order_id', paypalOrder.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const query = supabase.from('payments');
  const { data, error } = existing?.id
    ? await query.update(paymentRow).eq('id', existing.id).select().single()
    : await query.insert(paymentRow).select().single();
  if (error) throw error;
  if (!data?.id) throw new Error('Khong the luu giao dich PayPal. Vui long thu lai.');
  return data;
}

export async function createPayPalOrder(firebaseUser, appointmentId) {
  if (!appointmentId) return { ok: false, status: 400, data: { message: 'Thieu ma lich kham de thanh toan PayPal.' } };
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;
  if (!firebaseUser?.localId) return { ok: false, status: 401, data: { message: 'Bạn cần đăng nhập để thanh toán.' } };

  try {
    await expireStalePendingPayments();
    const { findOwnerProfile } = await import('./appointment_service.js');
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner?.id) return { ok: false, status: 401, data: { message: 'Khong tim thay ho so tai khoan.' } };

    const appointment = await getAppointmentForPayment(appointmentId, owner.id);
    const payable = validatePayableAppointment(appointment);
    if (!payable.ok) return payable;

    const accessToken = await getAccessToken();
    const paypalOrder = await paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `midhealth-${appointment.id}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: appointment.id,
          custom_id: appointment.id,
          description: `MidHealth appointment ${appointment.id}`,
          amount: {
            currency_code: config.paypalCurrency,
            value: paypalAmountFromVnd(appointment.deposit_amount),
          },
        }],
        application_context: {
          brand_name: 'midhealth',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: withQueryParams(config.paypalReturnUrl, { appointmentId: appointment.id }),
          cancel_url: withQueryParams(config.paypalCancelUrl, {
            appointmentId: appointment.id,
            cancelToken: signPaymentToken(appointment.id),
          }),
        },
      }),
    });

    const approvalUrl = paypalOrder.links?.find((link) => link.rel === 'approve')?.href;
    if (!paypalOrder.id || !approvalUrl || !approvalUrl.startsWith('https://')) {
      return { ok: false, status: 503, data: { message: 'PayPal chưa trả về liên kết thanh toán hợp lệ. Vui lòng thử lại.' } };
    }

    const payment = await upsertPendingPayment({ appointment, paypalOrder });
    await supabase
      .from('appointments')
      .update({ payment_status: 'pending' })
      .eq('id', appointment.id);

    return {
      ok: true,
      status: 201,
      data: {
        paymentId: payment.id,
        orderId: paypalOrder.id,
        approvalUrl,
        amount: appointment.deposit_amount,
        currency: 'VND',
        paypalAmount: paypalAmountFromVnd(appointment.deposit_amount),
        paypalCurrency: config.paypalCurrency,
      },
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function capturePayPalOrder(orderId) {
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;

  try {
    const { data: existingPayment, error: existingError } = await supabase
      .from('payments')
      .select('id, status, appointment_id')
      .eq('paypal_order_id', orderId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existingPayment?.id) return { ok: false, status: 404, data: { message: 'Không tìm thấy giao dịch PayPal của lịch khám.' } };
    if (existingPayment?.status === 'paid') {
      const confirmed = await supabase.rpc('confirm_clinic_deposit', { payment_id_value: existingPayment.id });
      if (confirmed.error) return { ok: false, status: 409, data: { code: 'PAYMENT_REVIEW_REQUIRED', message: 'Đã nhận tiền nhưng lịch không thể xác nhận. Vui lòng liên hệ phòng khám để đối soát.' } };
      return { ok: true, status: 200, data: { status: 'COMPLETED', alreadyCaptured: true } };
    }

    const accessToken = await getAccessToken();
    const capture = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `midhealth-capture-${existingPayment.id}`,
      },
    });
    const completedCapture = capture.purchase_units?.flatMap(unit => unit.payments?.captures || [])
      .find(item => item.status === 'COMPLETED' && item.id);
    const captureId = completedCapture?.id || null;
    const status = capture.status === 'COMPLETED' && captureId ? 'paid' : 'pending';

    const { data: payment, error } = await supabase
      .from('payments')
      .update({
        status,
        paypal_capture_id: captureId,
        paid_at: status === 'paid' ? new Date().toISOString() : null,
        raw_payload: capture,
      })
      .eq('paypal_order_id', orderId)
      .neq('status', 'paid')
      .select('id, appointment_id')
      .maybeSingle();
    if (error) throw error;

    if (payment?.appointment_id) {
      if (status === 'paid') {
        const confirmed = await supabase.rpc('confirm_clinic_deposit', { payment_id_value: payment.id });
        if (confirmed.error) return { ok: false, status: 409, data: { code: 'PAYMENT_REVIEW_REQUIRED', message: 'Đã nhận tiền nhưng lịch không thể xác nhận. Vui lòng liên hệ phòng khám để đối soát.' } };
      }
    }

    return status === 'paid'
      ? { ok: true, status: 200, data: capture }
      : { ok: false, status: 202, data: { code: 'PAYMENT_PENDING', message: 'PayPal chưa xác nhận đã thu tiền. Lịch đang chờ đối soát.' } };
  } catch (error) {
    console.error('PayPal capture requires reconciliation:', orderId, error.message);
    return { ok: false, status: 503, data: { code: 'PAYMENT_REVIEW_REQUIRED', message: 'Chưa xác định được kết quả thanh toán. Vui lòng kiểm tra lịch trước khi thử lại; nếu PayPal đã thu tiền, liên hệ phòng khám để đối soát.' } };
  }
}

export async function cancelPayPalOrder(orderId, appointmentId = '', cancelToken = '') {
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;
  if (!isValidPaymentToken(appointmentId, cancelToken)) {
    return { ok: false, status: 401, data: { message: 'Yêu cầu hủy thanh toán không hợp lệ.' } };
  }

  try {
    let payment = null;
    if (orderId) {
      const { data, error } = await supabase
        .from('payments')
        .select('id, appointment_id, status')
        .eq('paypal_order_id', orderId)
        .maybeSingle();
      if (error) throw error;
      payment = data;
      if (!payment || payment.appointment_id !== appointmentId) {
        return { ok: false, status: 401, data: { message: 'Đơn PayPal không thuộc lịch khám này.' } };
      }
    }

    if (payment?.status === 'paid') {
      return { ok: false, status: 409, data: { message: 'Khoản cọc đã được ghi nhận; không thể hủy tự động.' } };
    }
    // The browser may return from PayPal while a capture is still in flight.
    // Keep the booking pending until provider reconciliation proves it was voided.
    return { ok: true, status: 200, data: { cancelled: false, pending: true, appointmentId } };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function reconcilePendingPayPalOrders(maxAgeMinutes = Number(config.paymentPendingExpiryMinutes || 15)) {
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;
  try {
    const cutoff = new Date(Date.now() - Math.max(Number(maxAgeMinutes) || 15, 1) * 60_000).toISOString();
    const { data: payments, error } = await supabase.from('payments')
      .select('id, appointment_id, paypal_order_id, status')
      .eq('status', 'pending').lt('created_at', cutoff)
      .order('updated_at', { ascending: true }).limit(50);
    if (error) throw error;
    let lastPaidId = null;
    for (;;) {
      let paidQuery = supabase.from('payments')
        .select('id, appointments!inner(status)')
        .eq('status', 'paid').eq('appointments.status', 'pending')
        .order('id', { ascending: true }).limit(50);
      if (lastPaidId) paidQuery = paidQuery.gt('id', lastPaidId);
      const { data: paidButUnconfirmed, error: reviewError } = await paidQuery;
      if (reviewError) throw reviewError;
      if (!paidButUnconfirmed?.length) break;
      for (const payment of paidButUnconfirmed) {
        const confirmed = await supabase.rpc('confirm_clinic_deposit', { payment_id_value: payment.id });
        if (confirmed.error) console.error('Paid appointment still requires review:', payment.id, confirmed.error.message);
      }
      lastPaidId = paidButUnconfirmed.at(-1).id;
      if (paidButUnconfirmed.length < 50) break;
    }
    if (!payments?.length) return { ok: true, status: 200, data: { checked: 0 } };
    const accessToken = await getAccessToken();
    let checked = 0;
    for (const payment of payments) {
      if (!payment.paypal_order_id) continue;
      try {
        const order = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(payment.paypal_order_id)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        checked += 1;
        const capture = order.purchase_units?.flatMap(unit => unit.payments?.captures || [])
          .find(item => item.status === 'COMPLETED');
        if (order.status === 'COMPLETED' && capture?.id) {
          const { data: saved, error: saveError } = await supabase.from('payments')
            .update({ status: 'paid', paypal_capture_id: capture.id, paid_at: new Date().toISOString(), raw_payload: order })
            .eq('id', payment.id).eq('status', 'pending').select('id').maybeSingle();
          if (saveError) throw saveError;
          if (saved?.id) {
            const confirmed = await supabase.rpc('confirm_clinic_deposit', { payment_id_value: saved.id });
            if (confirmed.error) console.error('Captured payment requires manual appointment review:', saved.id, confirmed.error.message);
          }
        } else if (order.status === 'VOIDED') {
          const { data: saved, error: saveError } = await supabase.from('payments')
            .update({ status: 'failed', raw_payload: order })
            .eq('id', payment.id).eq('status', 'pending').select('appointment_id').maybeSingle();
          if (saveError) throw saveError;
          if (saved?.appointment_id) await cancelAppointmentForFailedPayment(saved.appointment_id, 'failed');
        } else {
          await supabase.from('payments').update({ updated_at: new Date().toISOString() })
            .eq('id', payment.id).eq('status', 'pending');
        }
      } catch (error) {
        console.error('PayPal order reconciliation failed:', payment.paypal_order_id, error.message);
      }
    }
    return { ok: true, status: 200, data: { checked } };
  } catch (error) {
    return { ok: false, status: 503, data: { message: error.message } };
  }
}

async function verifyPayPalWebhook(headers = {}, payload = {}) {
  const accessToken = await getAccessToken();
  const verification = await paypalFetch('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: config.paypalWebhookId,
      webhook_event: payload,
    }),
  });

  return verification.verification_status === 'SUCCESS';
}

export async function handlePayPalWebhook(payload = {}, headers = {}) {
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;
  if (!config.paypalWebhookId) {
    return {
      ok: false,
      status: 503,
      data: { message: 'Backend chưa cấu hình PAYPAL_WEBHOOK_ID để xác minh webhook.' },
    };
  }

  try {
    const verified = await verifyPayPalWebhook(headers, payload);
    if (!verified) return { ok: false, status: 401, data: { message: 'Chữ ký webhook PayPal không hợp lệ.' } };

    const resource = payload.resource || {};
    const orderId = resource.supplementary_data?.related_ids?.order_id || resource.id;
    const captureId = resource.supplementary_data?.related_ids?.capture_id || (orderId === resource.id ? null : resource.id);
    const eventType = payload.event_type || '';
    const status = classifyPayPalWebhook(eventType, resource.status);
    if (!status) return { ok: true, status: 200, data: { received: true, ignored: true } };

    if (orderId) {
      const { data: existingPayment, error: existingError } = await supabase
        .from('payments')
        .select('id, status, appointment_id')
        .eq('paypal_order_id', orderId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existingPayment?.id || (existingPayment.status === 'paid' && status !== 'paid')) {
        return { ok: true, status: 200, data: { received: true, ignored: true } };
      }

      const { data: payment } = await supabase
        .from('payments')
        .update({
          status,
          paypal_capture_id: captureId,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
          raw_payload: payload,
        })
        .eq('id', existingPayment.id)
        .select('appointment_id')
        .maybeSingle();

      if (payment?.appointment_id) {
        if (status === 'failed') {
          await cancelAppointmentForFailedPayment(payment.appointment_id, 'failed');
        } else {
          if (status === 'paid') {
            const confirmed = await supabase.rpc('confirm_clinic_deposit', { payment_id_value: payment.id });
            if (confirmed.error) throw confirmed.error;
          } else {
            await supabase.from('appointments').update({ payment_status: status }).eq('id', payment.appointment_id);
          }
        }
      }
    }

    return { ok: true, status: 200, data: { received: true } };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
