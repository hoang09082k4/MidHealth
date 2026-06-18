import crypto from 'node:crypto';
import { cancelAppointmentForFailedPayment, expireStalePendingPayments } from './appointment_service.js';
import { config } from './config.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

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
  return config.jwtSecret || config.paypalClientSecret || config.momoSecretKey || 'midhealth-payment-token';
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
  const response = await fetch(`${paypalBaseUrl}${path}`, options);
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
    .select('id, owner_profile_id, final_amount, payment_status')
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
    amount: appointment.final_amount,
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
    if (!owner) return { ok: false, status: 401, data: { message: 'Không tìm thấy hồ sơ tài khoản.' } };

    const appointment = await getAppointmentForPayment(appointmentId, owner.id);
    if (!appointment) return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch khám.' } };
    if (appointment.payment_status === 'paid') {
      return { ok: false, status: 409, data: { message: 'Lịch khám này đã thanh toán.' } };
    }

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
            value: paypalAmountFromVnd(appointment.final_amount),
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
        approvalUrl: paypalOrder.links?.find((link) => link.rel === 'approve')?.href,
        amount: appointment.final_amount,
        currency: 'VND',
        paypalAmount: paypalAmountFromVnd(appointment.final_amount),
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
    if (existingPayment?.status === 'paid') {
      return { ok: true, status: 200, data: { status: 'COMPLETED', alreadyCaptured: true } };
    }

    const accessToken = await getAccessToken();
    const capture = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
    const status = capture.status === 'COMPLETED' ? 'paid' : 'pending';

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
      .select('appointment_id')
      .maybeSingle();
    if (error) throw error;

    if (payment?.appointment_id) {
      if (status === 'paid') {
        await supabase
          .from('appointments')
          .update({ payment_status: status })
          .eq('id', payment.appointment_id)
          .neq('payment_status', 'paid');
      } else {
        await cancelAppointmentForFailedPayment(payment.appointment_id, 'failed');
      }
    }

    return { ok: status === 'paid', status: status === 'paid' ? 200 : 202, data: capture };
  } catch (error) {
    const { data: payment } = await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('paypal_order_id', orderId)
      .neq('status', 'paid')
      .select('appointment_id')
      .maybeSingle();
    if (payment?.appointment_id) {
      await cancelAppointmentForFailedPayment(payment.appointment_id, 'failed');
    }
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function cancelPayPalOrder(orderId, appointmentId = '', cancelToken = '') {
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;

  try {
    let payment = null;
    if (orderId) {
      const { data, error } = await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('paypal_order_id', orderId)
        .neq('status', 'paid')
        .select('appointment_id')
        .maybeSingle();
      if (error) throw error;
      payment = data;
    }

    const targetAppointmentId = payment?.appointment_id || appointmentId;
    if (targetAppointmentId) {
      if (!payment?.appointment_id && !isValidPaymentToken(targetAppointmentId, cancelToken)) {
        return { ok: false, status: 401, data: { message: 'Yeu cau huy thanh toan khong hop le.' } };
      }
      await cancelAppointmentForFailedPayment(targetAppointmentId, 'failed');
    }

    return { ok: true, status: 200, data: { cancelled: true, appointmentId: targetAppointmentId || null } };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
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
    const status = eventType.includes('COMPLETED') || resource.status === 'COMPLETED'
      ? 'paid'
      : eventType.includes('DECLINED') || eventType.includes('VOIDED')
        ? 'failed'
        : 'pending';

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
          await supabase
            .from('appointments')
            .update({ payment_status: status })
            .eq('id', payment.appointment_id);
        }
      }
    }

    return { ok: true, status: 200, data: { received: true } };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
