/* Razorpay payments.
 *
 * server/.env:
 *   RAZORPAY_KEY_ID=rzp_test_xxx
 *   RAZORPAY_KEY_SECRET=xxx
 *   RAZORPAY_WEBHOOK_SECRET=xxx        (set the same value in the Razorpay dashboard)
 *
 * Two rules this module exists to enforce:
 *   1. The amount charged is computed here from the catalogue, never taken from
 *      the browser. A client that posts price: 1 gets charged the real price.
 *   2. An order is only marked paid after its signature verifies against the
 *      key secret. A success callback on its own proves nothing.
 */
import crypto from 'crypto';

const KEY_ID = () => process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = () => process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = () => process.env.RAZORPAY_WEBHOOK_SECRET || '';

export const isConfigured = () => Boolean(KEY_ID() && KEY_SECRET());
export const publicKey = () => KEY_ID();

let client = null;
async function sdk() {
  if (!client) {
    const { default: Razorpay } = await import('razorpay');
    client = new Razorpay({ key_id: KEY_ID(), key_secret: KEY_SECRET() });
  }
  return client;
}

/** Razorpay works in the smallest currency unit, so rupees -> paise. */
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);

export async function createOrder({ amount, receipt, notes = {} }) {
  const rzp = await sdk();
  return rzp.orders.create({
    amount: toPaise(amount),
    currency: 'INR',
    receipt: String(receipt).slice(0, 40),
    notes,
  });
}

/**
 * Checkout callback signature: HMAC-SHA256 of "<order_id>|<payment_id>" keyed
 * with the API secret.
 */
export function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;
  const expected = crypto
    .createHmac('sha256', KEY_SECRET())
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  return timingSafeEqual(expected, razorpay_signature);
}

/** Webhook signature: HMAC-SHA256 over the exact raw request body. */
export function verifyWebhookSignature(rawBody, signature) {
  if (!rawBody || !signature || !WEBHOOK_SECRET()) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET()).update(rawBody).digest('hex');
  return timingSafeEqual(expected, signature);
}

/* Constant-time compare so a wrong signature leaks nothing through timing. */
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Fetch a payment from Razorpay -- used to confirm state independently. */
export async function fetchPayment(paymentId) {
  const rzp = await sdk();
  return rzp.payments.fetch(paymentId);
}
