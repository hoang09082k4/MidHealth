export function validatePayableAppointment(appointment) {
  if (!appointment) return { ok: false, status: 404, data: { message: 'Không tìm thấy lịch khám.' } };
  if (!['pending', 'confirmed'].includes(appointment.status)) {
    return { ok: false, status: 409, data: { message: 'Lịch khám này không còn nhận thanh toán.' } };
  }
  if (['paid', 'refunded'].includes(appointment.payment_status)) {
    return { ok: false, status: 409, data: { message: 'Lịch khám đã thanh toán hoặc đã hoàn tiền.' } };
  }
  if (!Number.isFinite(Number(appointment.deposit_amount)) || Number(appointment.deposit_amount) <= 0) {
    return { ok: false, status: 409, data: { message: 'Lịch khám không có khoản phí cần thanh toán.' } };
  }
  return { ok: true };
}

export function classifyPayPalWebhook(eventType, resourceStatus) {
  if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && resourceStatus === 'COMPLETED') return 'paid';
  if (['PAYMENT.CAPTURE.DENIED', 'CHECKOUT.ORDER.DECLINED'].includes(eventType)) return 'failed';
  return null;
}
