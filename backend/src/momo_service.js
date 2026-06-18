import crypto from 'node:crypto';
import { cancelAppointmentForFailedPayment, expireStalePendingPayments } from './appointment_service.js';
import { config } from './config.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

const momoCreatePath = '/v2/gateway/api/create';
const momoQueryPath = '/v2/gateway/api/query';

function requirePaymentConfig() {
  if (!hasSupabaseConfig) {
    return { ok: false, status: 503, data: { message: 'Backend chua cau hinh Supabase.' } };
  }
  if (!config.momoPartnerCode || !config.momoAccessKey || !config.momoSecretKey) {
    return { ok: false, status: 503, data: { message: 'Backend chua cau hinh MoMo.' } };
  }
  return { ok: true };
}

function receiptNumber() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `MOMO${date}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function momoSignature(rawSignature) {
  return crypto.createHmac('sha256', config.momoSecretKey).update(rawSignature).digest('hex');
}

function positiveVndAmount(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? amount : 0;
}

function momoOrderId(appointmentId) {
  return `MH${Date.now()}${crypto.randomBytes(2).toString('hex').toUpperCase()}_${appointmentId}`;
}

async function momoFetch(path, body) {
  const response = await fetch(`${config.momoEndpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.localMessage || 'MoMo request failed.');
  }
  return data;
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

async function upsertPendingPayment({ appointment, momoOrder }) {
  const paymentRow = {
    appointment_id: appointment.id,
    owner_profile_id: appointment.owner_profile_id,
    amount: appointment.final_amount,
    currency: 'VND',
    method: 'momo_atm',
    status: 'pending',
    provider: 'momo',
    transaction_code: momoOrder.orderId,
    receipt_number: receiptNumber(),
    raw_payload: momoOrder,
  };

  const { data: existing, error: lookupError } = await supabase
    .from('payments')
    .select('id')
    .eq('transaction_code', momoOrder.orderId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const query = supabase.from('payments');
  const { data, error } = existing?.id
    ? await query.update(paymentRow).eq('id', existing.id).select().single()
    : await query.insert(paymentRow).select().single();
  if (error) throw error;
  if (!data?.id) throw new Error('Khong the luu giao dich MoMo. Vui long thu lai.');
  return data;
}

function buildCreateRequest({ appointment, orderId, requestId }) {
  const amount = String(positiveVndAmount(appointment.final_amount));
  const extraData = Buffer.from(JSON.stringify({ appointmentId: appointment.id })).toString('base64');
  const requestType = 'payWithATM';
  const orderInfo = `Thanh toan lich kham MidHealth ${appointment.id}`;
  const rawSignature = [
    `accessKey=${config.momoAccessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${config.momoIpnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${config.momoPartnerCode}`,
    `redirectUrl=${config.momoReturnUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join('&');

  return {
    partnerCode: config.momoPartnerCode,
    partnerName: config.momoPartnerName,
    storeId: config.momoStoreId,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl: config.momoReturnUrl,
    ipnUrl: config.momoIpnUrl,
    lang: 'vi',
    requestType,
    autoCapture: true,
    extraData,
    orderGroupId: '',
    signature: momoSignature(rawSignature),
  };
}

function buildQueryRequest(orderId) {
  const requestId = `${config.momoPartnerCode}${Date.now()}`;
  const rawSignature = [
    `accessKey=${config.momoAccessKey}`,
    `orderId=${orderId}`,
    `partnerCode=${config.momoPartnerCode}`,
    `requestId=${requestId}`,
  ].join('&');

  return {
    partnerCode: config.momoPartnerCode,
    requestId,
    orderId,
    lang: 'vi',
    signature: momoSignature(rawSignature),
  };
}

function statusFromMoMoResult(resultCode) {
  return Number(resultCode) === 0 ? 'paid' : 'failed';
}

async function updatePaymentFromMoMo(orderId, payload = {}) {
  const status = statusFromMoMoResult(payload.resultCode);
  const { data: existingPayment, error: existingError } = await supabase
    .from('payments')
    .select('id, appointment_id, amount, status')
    .eq('transaction_code', orderId)
    .eq('provider', 'momo')
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existingPayment?.id) throw new Error('Khong tim thay giao dich MoMo.');
  if (existingPayment.status === 'paid' && status !== 'paid') return;

  const payloadAmount = Math.round(Number(payload.amount) || 0);
  if (payloadAmount && payloadAmount !== Math.round(Number(existingPayment.amount) || 0)) {
    throw new Error('So tien MoMo khong khop voi giao dich da tao.');
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .update({
      status,
      raw_payload: payload,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', existingPayment.id)
    .neq('status', 'paid')
    .select('appointment_id')
    .maybeSingle();
  if (error) throw error;

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

function verifyIpnSignature(payload = {}) {
  const rawSignature = [
    `accessKey=${config.momoAccessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData || ''}`,
    `message=${payload.message || ''}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo || ''}`,
    `orderType=${payload.orderType || ''}`,
    `partnerCode=${payload.partnerCode}`,
    `payType=${payload.payType || ''}`,
    `requestId=${payload.requestId}`,
    `responseTime=${payload.responseTime}`,
    `resultCode=${payload.resultCode}`,
    `transId=${payload.transId || ''}`,
  ].join('&');
  return payload.signature === momoSignature(rawSignature);
}

export async function createMoMoAtmPayment(firebaseUser, appointmentId) {
  if (!appointmentId) return { ok: false, status: 400, data: { message: 'Thieu ma lich kham de thanh toan MoMo.' } };
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;
  if (!firebaseUser?.localId) return { ok: false, status: 401, data: { message: 'Ban can dang nhap de thanh toan.' } };

  try {
    await expireStalePendingPayments();
    const { findOwnerProfile } = await import('./appointment_service.js');
    const owner = await findOwnerProfile(firebaseUser);
    if (!owner?.id) return { ok: false, status: 401, data: { message: 'Khong tim thay ho so tai khoan.' } };
    if (!owner) return { ok: false, status: 401, data: { message: 'Khong tim thay ho so tai khoan.' } };

    const appointment = await getAppointmentForPayment(appointmentId, owner.id);
    if (!appointment) return { ok: false, status: 404, data: { message: 'Khong tim thay lich kham.' } };
    if (appointment.payment_status === 'paid') {
      return { ok: false, status: 409, data: { message: 'Lich kham nay da thanh toan.' } };
    }

    const amount = positiveVndAmount(appointment.final_amount);
    if (!amount) {
      await supabase.from('appointments').update({ payment_status: 'paid' }).eq('id', appointment.id);
      return { ok: true, status: 200, data: { amount: 0, currency: 'VND', status: 'paid' } };
    }

    const orderId = momoOrderId(appointment.id);
    const requestId = orderId;
    const requestBody = buildCreateRequest({ appointment, orderId, requestId });
    const momoOrder = await momoFetch(momoCreatePath, requestBody);
    if (Number(momoOrder.resultCode) !== 0 || !momoOrder.payUrl) {
      throw new Error(momoOrder.message || momoOrder.localMessage || 'MoMo khong tra ve duong dan thanh toan.');
    }
    const { signature, ...requestBodyForLog } = requestBody;
    const payment = await upsertPendingPayment({
      appointment,
      momoOrder: { ...momoOrder, orderId, requestId, requestBody: requestBodyForLog },
    });

    await supabase
      .from('appointments')
      .update({ payment_status: 'pending' })
      .eq('id', appointment.id);

    return {
      ok: true,
      status: 201,
      data: {
        paymentId: payment.id,
        orderId,
        requestId,
        payUrl: momoOrder.payUrl,
        deeplink: momoOrder.deeplink,
        amount,
        currency: 'VND',
        method: 'momo_atm',
      },
    };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function handleMoMoReturn(orderId) {
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;
  if (!orderId) return { ok: false, status: 400, data: { message: 'Thieu ma don hang MoMo.' } };

  try {
    const query = await momoFetch(momoQueryPath, buildQueryRequest(orderId));
    await updatePaymentFromMoMo(orderId, query);
    return { ok: Number(query.resultCode) === 0, status: 200, data: query };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function handleMoMoIpn(payload = {}) {
  const ready = requirePaymentConfig();
  if (!ready.ok) return ready;

  try {
    if (!verifyIpnSignature(payload)) {
      return { ok: false, status: 401, data: { message: 'Chu ky IPN MoMo khong hop le.' } };
    }
    await updatePaymentFromMoMo(payload.orderId, payload);
    return { ok: true, status: 200, data: { received: true } };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
