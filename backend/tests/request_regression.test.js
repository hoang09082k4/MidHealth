import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { handleRequest, getRequestIp } from '../src/server.js';
import { config } from '../src/config.js';
import { verifyOtpToken, verifyEmailOtp } from '../src/otp_service.js';
import { classifyPayPalWebhook, validatePayableAppointment } from '../src/payment_policy.js';
import { createRateLimiter } from '../src/rate_limit.js';

test('only verified capture completion can mark a PayPal deposit paid', () => {
  assert.equal(classifyPayPalWebhook('PAYMENT.CAPTURE.COMPLETED', 'COMPLETED'), 'paid');
  assert.equal(classifyPayPalWebhook('PAYMENT.CAPTURE.DENIED', 'DECLINED'), 'failed');
  assert.equal(classifyPayPalWebhook('CHECKOUT.ORDER.DECLINED', 'DECLINED'), 'failed');
  assert.equal(classifyPayPalWebhook('CHECKOUT.ORDER.APPROVED', 'COMPLETED'), null);
  assert.equal(classifyPayPalWebhook('PAYMENT.CAPTURE.PENDING', 'PENDING'), null);
  assert.equal(classifyPayPalWebhook('PAYMENT.CAPTURE.REFUNDED', 'COMPLETED'), null);
});
function response() {
  return {
    setHeader() {},
    writeHead(status) { this.status = status; },
    end(body) { this.body = JSON.parse(body); },
  };
}

test('private reads reject guests; removed queue creation stays unavailable', async () => {
  for (const [method, url, expected] of [
    ['GET', '/api/patient/profiles', 401], ['GET', '/api/appointments', 401],
    ['POST', '/api/queue', 404], ['GET', '/api/doctors/%E0%A4%A/slots', 400],
    ['POST', '/api/payments/momo/create-atm-payment', 404],
    ['GET', '/api/payments/momo/return', 404],
    ['POST', '/api/payments/momo/ipn', 404],
  ]) {
    const res = response();
    await handleRequest({ method, url, headers: { host: 'localhost' } }, res);
    assert.equal(res.status, expected, url);
  }
});

test('client cannot spoof rate limit IP unless a trusted proxy is configured', () => {
  const previous = config.trustProxy;
  const request = { headers: { 'x-forwarded-for': '203.0.113.9' }, socket: { remoteAddress: '127.0.0.1' } };
  try {
    config.trustProxy = false;
    assert.equal(getRequestIp(request), '127.0.0.1');
    config.trustProxy = true;
    assert.equal(getRequestIp(request), '203.0.113.9');
  } finally { config.trustProxy = previous; }
});

test('health distinguishes Firebase client configuration from Admin SDK credentials', async () => {
  const res = response();
  await handleRequest({ method: 'GET', url: '/api/health', headers: { host: 'localhost' } }, res);
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.firebaseClient, 'string');
  assert.equal(typeof res.body.firebaseAdmin, 'string');
  assert.equal(Object.hasOwn(res.body, 'firebase'), false);
  assert.ok(!Object.values(res.body).includes('connected'));
});

test('payment rejects terminal, paid, refunded and invalid fee appointments', () => {
  const appointment = { status: 'pending', payment_status: 'unpaid', final_amount: 180000, deposit_amount: 54000 };
  assert.equal(validatePayableAppointment(appointment).ok, true);
  for (const status of ['cancelled', 'completed', 'no_show']) {
    assert.equal(validatePayableAppointment({ ...appointment, status }).status, 409);
  }
  for (const payment_status of ['paid', 'refunded']) {
    assert.equal(validatePayableAppointment({ ...appointment, payment_status }).status, 409);
  }
  for (const deposit_amount of [0, -1, 'invalid', Infinity]) {
    assert.equal(validatePayableAppointment({ ...appointment, deposit_amount }).status, 409);
  }
});

test('rate limits expire and stay bounded when new clients flood the service', () => {
  let time = 0;
  const limited = createRateLimiter({ limit: 2, windowMs: 100, maxKeys: 2, now: () => time });
  assert.equal(limited('a'), false);
  assert.equal(limited('a'), false);
  assert.equal(limited('a'), true);
  assert.equal(limited('b'), false);
  assert.equal(limited('c'), true);
  time = 100;
  assert.equal(limited('c'), false);
  assert.equal(limited('a'), false);
});

test('OTP rejects invalid input and signed tokens with invalid expiration or structure', async () => {
  assert.equal((await verifyEmailOtp(null, '123456')).status, 400);
  assert.equal((await verifyEmailOtp('patient@example.com', 123456)).status, 400);
  const secret = config.jwtSecret;
  config.jwtSecret = 'test-only-signing-key';
  try {
    const sign = (payload, alg = 'HS256') => {
      const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url');
      return `${header}.${body}.${signature}`;
    };
    const payload = { purpose: 'email_otp', email: 'patient@example.com', jti: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + 60 };
    assert.equal(verifyOtpToken(sign(payload)).email, payload.email);
    assert.equal(verifyOtpToken(sign(payload) + '.extra'), null);
    assert.equal(verifyOtpToken(sign({ ...payload, exp: undefined })), null);
    assert.equal(verifyOtpToken(sign({ ...payload, exp: Math.floor(Date.now() / 1000) })), null);
    assert.equal(verifyOtpToken(sign(payload, 'none')), null);
  } finally { config.jwtSecret = secret; }
});
