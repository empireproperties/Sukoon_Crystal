/**
 * email.js — Transactional order emails via Resend
 *
 * Called ONLY after a payment is confirmed (prepaid or COD advance).
 * Fire-and-forget: errors are logged but never propagate to the order flow.
 */

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = 'Sukoon Crystal Solutions <orders@sukoon-crystalsolutions.com>';
const SITE_URL = 'https://sukoon-crystalsolutions.com';
const LOGO_URL = `${SITE_URL}/logo.png`;

/* ── helpers ── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/* ── main export ── */
export async function sendOrderConfirmationEmail(order) {
  if (!resend) {
    console.log('  ℹ email: RESEND_API_KEY not set — skipping order confirmation email');
    return;
  }

  const to = order?.customer?.email;
  if (!to || !to.includes('@')) {
    console.log('  ℹ email: no valid customer email on order', order?.id);
    return;
  }

  try {
    const html = buildOrderEmailHtml(order);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `✅ Order Confirmed — #${order.number} | Sukoon Crystal Solutions`,
      html,
    });

    if (error) {
      console.error('  ✗ email send error:', error);
    } else {
      console.log(`  ✉ order confirmation sent to ${to} — Resend ID: ${data?.id}`);
    }
  } catch (err) {
    /* Never crash the order flow because of an email failure */
    console.error('  ✗ email exception:', err?.message);
  }
}

/* ── HTML builder ── */
function buildOrderEmailHtml(order) {
  const {
    number, id, createdAt, status,
    customer = {}, items = [], subtotal = 0,
    shipping = 0, discount = 0, bogoDiscount = 0,
    total = 0, payment, balanceDue = 0, amountPaid,
    awb, courier,
  } = order;

  const date = new Date(createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const addr = customer.address || customer.addresses?.[0] || {};
  const addressLine = [addr.line1, addr.city, addr.state, addr.pincode]
    .filter(Boolean).join(', ');

  const isCOD = payment === 'COD';

  /* ── items rows ── */
  const itemsHtml = (items || []).map((it) => {
    const isBogo = it.bogo && it.qty >= 2;
    const freeQty = isBogo ? Math.floor(it.qty / 2) : 0;
    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f0e6d3;">
          <strong style="color:#4a2c2a;">${it.name || it.productName || 'Product'}</strong>
          ${isBogo ? `<br/><span style="font-size:11px;color:#c0392b;font-weight:600;">🎁 Buy 1 Get 1 Free — includes ${freeQty} free unit${freeQty > 1 ? 's' : ''}</span>` : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0e6d3;text-align:center;color:#6b4c4c;">${it.qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0e6d3;text-align:right;color:#4a2c2a;">${fmt(it.price * it.qty)}</td>
      </tr>`;
  }).join('');

  /* ── summary rows ── */
  const summaryRows = [
    ['Subtotal', fmt(subtotal)],
    shipping > 0 ? ['Delivery', fmt(shipping)] : ['Delivery', '<span style="color:#27ae60;">FREE</span>'],
    discount > 0 ? ['Coupon Discount', `<span style="color:#27ae60;">− ${fmt(discount)}</span>`] : null,
    bogoDiscount > 0 ? ['BOGO Discount', `<span style="color:#27ae60;">− ${fmt(bogoDiscount)}</span>`] : null,
  ].filter(Boolean).map(([label, val]) => `
    <tr>
      <td style="padding:5px 8px;color:#6b4c4c;">${label}</td>
      <td style="padding:5px 8px;text-align:right;color:#4a2c2a;">${val}</td>
    </tr>`).join('');

  /* ── COD notice ── */
  const codNotice = isCOD ? `
    <div style="margin:20px 0;padding:14px 18px;background:#fff8e1;border-left:4px solid #f39c12;border-radius:6px;">
      <strong style="color:#e67e22;">💵 Cash on Delivery Order</strong><br/>
      <span style="font-size:13px;color:#7f6000;">
        Advance paid: <strong>${fmt(amountPaid)}</strong> &nbsp;|&nbsp;
        Balance due at delivery: <strong>${fmt(balanceDue)}</strong>
      </span>
    </div>` : '';

  /* ── tracking ── */
  const trackingHtml = awb ? `
    <div style="margin:20px 0;padding:14px 18px;background:#f0fff0;border-left:4px solid #27ae60;border-radius:6px;">
      <strong style="color:#196f3d;">📦 Shipping via ${courier || 'Courier'}</strong><br/>
      <span style="font-size:13px;color:#196f3d;">AWB: <strong>${awb}</strong></span>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Order Confirmed — Sukoon Crystal Solutions</title>
</head>
<body style="margin:0;padding:0;background:#fdf6ee;font-family:Georgia,'Times New Roman',serif;">

  <!-- wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6ee;">
    <tr><td align="center" style="padding:30px 10px;">

      <!-- card -->
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- header -->
        <tr>
          <td style="background:linear-gradient(135deg,#8b1a1a 0%,#c0392b 100%);padding:32px 30px;text-align:center;">
            <div style="font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:1px;">🪷 Sukoon Crystal Solutions</div>
            <div style="font-size:13px;color:#f8c0c0;margin-top:4px;">Crystals · Wellness · Spirituality</div>
          </td>
        </tr>

        <!-- success banner -->
        <tr>
          <td style="background:#f0fff4;padding:20px 30px;text-align:center;border-bottom:1px solid #d5f5e3;">
            <div style="font-size:42px;">✅</div>
            <div style="font-size:22px;font-weight:bold;color:#196f3d;margin-top:8px;">Order Confirmed!</div>
            <div style="font-size:14px;color:#6b8f71;margin-top:6px;">Thank you, <strong>${customer.name || 'valued customer'}</strong>! Your order has been successfully placed.</div>
          </td>
        </tr>

        <!-- body -->
        <tr>
          <td style="padding:28px 30px;">

            <!-- order meta -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#fdf6ee;border-radius:8px;padding:14px 18px;">
              <tr>
                <td style="font-size:13px;color:#6b4c4c;">Order Number</td>
                <td style="font-size:13px;color:#4a2c2a;font-weight:bold;text-align:right;">#${number}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6b4c4c;padding-top:6px;">Order ID</td>
                <td style="font-size:12px;color:#9b7b7b;text-align:right;padding-top:6px;">${id}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6b4c4c;padding-top:6px;">Date</td>
                <td style="font-size:13px;color:#4a2c2a;text-align:right;padding-top:6px;">${date}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6b4c4c;padding-top:6px;">Payment</td>
                <td style="font-size:13px;text-align:right;padding-top:6px;">
                  <span style="background:${isCOD ? '#fff3cd' : '#d4edda'};color:${isCOD ? '#856404' : '#155724'};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;">
                    ${isCOD ? '💵 Cash on Delivery' : '✅ Prepaid'}
                  </span>
                </td>
              </tr>
            </table>

            ${codNotice}

            <!-- items table -->
            <div style="font-size:15px;font-weight:bold;color:#4a2c2a;margin-bottom:10px;border-bottom:2px solid #c0392b;padding-bottom:6px;">🛒 Items Ordered</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr style="background:#fdf6ee;">
                  <th style="padding:8px;text-align:left;font-size:12px;color:#9b7b7b;font-weight:600;">ITEM</th>
                  <th style="padding:8px;text-align:center;font-size:12px;color:#9b7b7b;font-weight:600;">QTY</th>
                  <th style="padding:8px;text-align:right;font-size:12px;color:#9b7b7b;font-weight:600;">AMOUNT</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <!-- totals -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
              ${summaryRows}
              <tr>
                <td colspan="2" style="padding:8px;border-top:2px solid #c0392b;"></td>
              </tr>
              <tr>
                <td style="padding:6px 8px;font-size:16px;font-weight:bold;color:#4a2c2a;">Total</td>
                <td style="padding:6px 8px;text-align:right;font-size:18px;font-weight:bold;color:#c0392b;">${fmt(total)}</td>
              </tr>
            </table>

            ${trackingHtml}

            <!-- delivery address -->
            ${addressLine ? `
            <div style="margin-top:20px;">
              <div style="font-size:14px;font-weight:bold;color:#4a2c2a;margin-bottom:6px;">📍 Delivery Address</div>
              <div style="font-size:13px;color:#6b4c4c;line-height:1.6;">${addressLine}</div>
            </div>` : ''}

            <!-- CTA -->
            <div style="text-align:center;margin:30px 0 10px;">
              <a href="${SITE_URL}/orders" style="display:inline-block;background:linear-gradient(135deg,#8b1a1a,#c0392b);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:30px;font-size:14px;font-weight:bold;letter-spacing:0.5px;">
                Track My Order →
              </a>
            </div>

          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="background:#fdf6ee;padding:20px 30px;text-align:center;border-top:1px solid #f0e6d3;">
            <div style="font-size:12px;color:#9b7b7b;line-height:1.8;">
              Questions? Reply to this email or contact us at<br/>
              <a href="mailto:sukoon.crystalsolutions@gmail.com" style="color:#c0392b;text-decoration:none;">sukoon.crystalsolutions@gmail.com</a>
            </div>
            <div style="font-size:11px;color:#bba898;margin-top:12px;">
              © ${new Date().getFullYear()} Sukoon Crystal Solutions · Made with 🪷
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}
