import crypto from 'node:crypto';
import { config } from './config.js';
import { calculateAppointmentPrice } from './pricing.js';
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
  const { data, error } = await supabase
    .from('appointments')
    .select('id, owner_profile_id, specialty_text, insurance_used, original_amount, insurance_discount, final_amount, payment_status, clinic_specialties(name)')
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
  return data;
}

export async function createPayPalOrder(firebaseUser, appointmentId) {
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;
  if (!firebaseUser?.localId) return { ok: false, status: 401, data: { message: 'Ban can dang nhap de thanh toan.' } };

  try {
    const { findOwnerProfile } = await import('./appointment_service.js');
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner) return { ok: false, status: 401, data: { message: 'Khong tim thay ho so tai khoan.' } };

    const appointment = await getAppointmentForPayment(appointmentId, owner.id);
    if (!appointment) return { ok: false, status: 404, data: { message: 'Khong tim thay lich kham.' } };
    if (appointment.payment_status === 'paid') {
      return { ok: false, status: 409, data: { message: 'Lich kham nay da thanh toan.' } };
    }

    const specialtyName = appointment.specialty_text || appointment.clinic_specialties?.name || '';
    const price = calculateAppointmentPrice({
      specialtyName,
      hasStandardInsurance: Boolean(appointment.insurance_used),
    });

    if (Number(appointment.final_amount) !== price.finalAmount) {
      await supabase
        .from('appointments')
        .update({
          original_amount: price.originalAmount,
          insurance_discount: price.insuranceDiscount,
          final_amount: price.finalAmount,
        })
        .eq('id', appointment.id);
      appointment.original_amount = price.originalAmount;
      appointment.insurance_discount = price.insuranceDiscount;
      appointment.final_amount = price.finalAmount;
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
          return_url: config.paypalReturnUrl,
          cancel_url: config.paypalCancelUrl,
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
      .select('appointment_id')
      .maybeSingle();
    if (error) throw error;

    if (payment?.appointment_id) {
      await supabase
        .from('appointments')
        .update({ payment_status: status })
        .eq('id', payment.appointment_id);
    }

    return { ok: true, status: 200, data: capture };
  } catch (error) {
    await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('paypal_order_id', orderId);
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
      data: { message: 'Backend chua cau hinh PAYPAL_WEBHOOK_ID de xac minh webhook.' },
    };
  }

  try {
    const verified = await verifyPayPalWebhook(headers, payload);
    if (!verified) return { ok: false, status: 401, data: { message: 'Chu ky webhook PayPal khong hop le.' } };

    const resource = payload.resource || {};
    const orderId = resource.id || resource.supplementary_data?.related_ids?.order_id;
    const captureId = resource.supplementary_data?.related_ids?.capture_id || resource.id;
    const eventType = payload.event_type || '';
    const status = eventType.includes('COMPLETED') || resource.status === 'COMPLETED'
      ? 'paid'
      : eventType.includes('DECLINED') || eventType.includes('VOIDED')
        ? 'failed'
        : 'pending';

    if (orderId) {
      const { data: payment } = await supabase
        .from('payments')
        .update({
          status,
          paypal_capture_id: captureId,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
          raw_payload: payload,
        })
        .eq('paypal_order_id', orderId)
        .select('appointment_id')
        .maybeSingle();

      if (payment?.appointment_id) {
        await supabase
          .from('appointments')
          .update({ payment_status: status })
          .eq('id', payment.appointment_id);
      }
    }

    return { ok: true, status: 200, data: { received: true } };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
