/**
 * Comprehensive Automated Test Suite for Sukoon Crystal Solutions
 * Tests APIs, Storefront, BOGO, Cart Calculations, Payments, Auth & Admin
 */

const BASE_URL = process.env.TEST_URL || 'https://sukoon-crystalsolutions.com';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failures.push({ testName, details });
  }
}

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`  Running Full Sukoon Crystal Solutions Test Suite`);
  console.log(`  Target Environment: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let adminToken = null;
  let sampleProduct = null;
  let bogoProduct = null;

  // -----------------------------------------------------------------
  // 1. Storefront & Public Configuration
  // -----------------------------------------------------------------
  console.log(`[Group 1: Storefront & Configuration]`);
  try {
    const settingsRes = await fetch(`${BASE_URL}/api/settings`);
    assert(settingsRes.status === 200, 'GET /api/settings returns 200 OK');
    const settings = await settingsRes.json();
    assert(settings.delivery?.fee === 49, 'Default delivery fee is ₹49');
    assert(settings.delivery?.freeAbove === 600, 'Free delivery threshold is ₹600');
  } catch (e) {
    assert(false, 'GET /api/settings failed', e.message);
  }

  try {
    const catRes = await fetch(`${BASE_URL}/api/categories`);
    assert(catRes.status === 200, 'GET /api/categories returns 200 OK');
    const cats = await catRes.json();
    assert(Array.isArray(cats) && cats.length > 0, 'Categories list is populated', `count: ${cats.length}`);
  } catch (e) {
    assert(false, 'GET /api/categories failed', e.message);
  }

  try {
    const prodsRes = await fetch(`${BASE_URL}/api/products`);
    assert(prodsRes.status === 200, 'GET /api/products returns 200 OK');
    const prods = await prodsRes.json();
    assert(Array.isArray(prods) && prods.length > 0, 'Products list is populated', `count: ${prods.length}`);
    sampleProduct = prods[0];
    bogoProduct = prods.find((p) => p.bogo || p.slug === 'sukoon-hawan-cup');
    assert(Boolean(bogoProduct), 'BOGO Product (Sukoon Hawan Cup) is present in catalog');
  } catch (e) {
    assert(false, 'GET /api/products failed', e.message);
  }

  try {
    const slidesRes = await fetch(`${BASE_URL}/api/slides`);
    assert(slidesRes.status === 200, 'GET /api/slides returns 200 OK');
  } catch (e) {
    assert(false, 'GET /api/slides failed', e.message);
  }

  try {
    const eventsRes = await fetch(`${BASE_URL}/api/events`);
    assert(eventsRes.status === 200, 'GET /api/events returns 200 OK');
  } catch (e) {
    assert(false, 'GET /api/events failed', e.message);
  }

  try {
    const servicesRes = await fetch(`${BASE_URL}/api/services`);
    assert(servicesRes.status === 200, 'GET /api/services returns 200 OK');
  } catch (e) {
    assert(false, 'GET /api/services failed', e.message);
  }

  // -----------------------------------------------------------------
  // 2. Pricing, Cart & BOGO Logic
  // -----------------------------------------------------------------
  console.log(`\n[Group 2: Pricing, Delivery & BOGO Calculations]`);

  if (sampleProduct) {
    // Test: Subtotal under ₹600 -> Should charge delivery fee (₹49)
    try {
      const payOrderRes = await fetch(`${BASE_URL}/api/payments/razorpay/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: sampleProduct.id, slug: sampleProduct.slug, qty: 1 }],
          customer: { name: 'Test User', phone: '9876543210' },
          payment: 'Prepaid',
        }),
      });
      assert(payOrderRes.status === 200, 'Pricing cart under ₹600 returns 200 OK');
      const data = await payOrderRes.json();
      assert(data.totals.shipping === 49, 'Applies standard delivery fee ₹49 for cart under threshold');
      assert(data.totals.total === data.totals.subtotal + 49, 'Cart total equals subtotal + ₹49');
    } catch (e) {
      assert(false, 'Pricing cart under ₹600 failed', e.message);
    }

    // Test: Subtotal over ₹600 -> Delivery should be free (₹0)
    try {
      const payOrderRes = await fetch(`${BASE_URL}/api/payments/razorpay/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: sampleProduct.id, slug: sampleProduct.slug, qty: 10 }],
          customer: { name: 'Test User', phone: '9876543210' },
          payment: 'Prepaid',
        }),
      });
      const data = await payOrderRes.json();
      assert(data.totals.subtotal >= 600, 'Subtotal is over ₹600 threshold');
      assert(data.totals.shipping === 0, 'Free delivery (₹0) applied when subtotal >= ₹600');
    } catch (e) {
      assert(false, 'Pricing cart over ₹600 failed', e.message);
    }
  }

  if (bogoProduct) {
    // Test: BOGO product with 2 units -> 1 unit free!
    try {
      const bogoRes = await fetch(`${BASE_URL}/api/payments/razorpay/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: bogoProduct.id, slug: bogoProduct.slug, qty: 2 }],
          customer: { name: 'Test BOGO', phone: '9876543210' },
          payment: 'Prepaid',
        }),
      });
      const data = await bogoRes.json();
      assert(bogoRes.status === 200, 'BOGO cart creation returns 200 OK');
      assert(data.totals.subtotal === bogoProduct.price * 2, 'Subtotal is 2x unit price');
      // Subtotal minus 1 unit price + shipping (49)
      const expectedTotal = bogoProduct.price * 1 + data.totals.shipping;
      assert(data.totals.total === expectedTotal, `BOGO correctly discounts 1 unit (Total: ₹${data.totals.total}, Expected: ₹${expectedTotal})`);
    } catch (e) {
      assert(false, 'BOGO 2-unit calculation failed', e.message);
    }

    // Test: BOGO product with 4 units -> 2 units free!
    try {
      const bogo4Res = await fetch(`${BASE_URL}/api/payments/razorpay/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: bogoProduct.id, slug: bogoProduct.slug, qty: 4 }],
          customer: { name: 'Test BOGO', phone: '9876543210' },
          payment: 'Prepaid',
        }),
      });
      const data = await bogo4Res.json();
      // 4 units @ ₹200 = ₹800 subtotal (>= 600, so shipping is 0)
      // 2 units free = ₹400 discount
      // Total payable = ₹400
      assert(data.totals.total === bogoProduct.price * 2, `BOGO 4-units discounts 2 free units (Total: ₹${data.totals.total})`);
    } catch (e) {
      assert(false, 'BOGO 4-unit calculation failed', e.message);
    }
  }

  // -----------------------------------------------------------------
  // 3. Payment Gateway & COD Rules
  // -----------------------------------------------------------------
  console.log(`\n[Group 3: Payment Configuration & Cash on Delivery Rules]`);
  try {
    const payConfigRes = await fetch(`${BASE_URL}/api/payments/config`);
    assert(payConfigRes.status === 200, 'GET /api/payments/config returns 200 OK');
    const payConfig = await payConfigRes.json();
    assert(payConfig.razorpay === true, 'Razorpay online payments is active');
    assert(payConfig.keyId && payConfig.keyId.startsWith('rzp_'), 'Valid Razorpay Key ID published');
    assert(payConfig.codAdvance === 200, 'COD Advance configured as ₹200');
    assert(payConfig.codMinOrder === 500, 'COD Minimum Order configured as ₹500');
  } catch (e) {
    assert(false, 'Payment config failed', e.message);
  }

  // Test: COD on order < ₹500 should be rejected
  try {
    const codLowRes = await fetch(`${BASE_URL}/api/payments/razorpay/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: bogoProduct.id, slug: bogoProduct.slug, qty: 2 }], // ₹249 total < 500
        customer: { name: 'Test Low COD', phone: '9876543210' },
        payment: 'COD',
      }),
    });
    assert(codLowRes.status === 400, 'COD order below ₹500 is correctly rejected with 400 Bad Request');
  } catch (e) {
    assert(false, 'COD below ₹500 rejection check failed', e.message);
  }

  // -----------------------------------------------------------------
  // 4. Order Tracking Safety
  // -----------------------------------------------------------------
  console.log(`\n[Group 4: Order Tracking]`);
  try {
    const trackRes = await fetch(`${BASE_URL}/api/orders/track/NON_EXISTENT_ORDER_9999`);
    assert(trackRes.status === 404, 'Tracking invalid order number returns clean 404 Not Found');
  } catch (e) {
    assert(false, 'Order tracking test failed', e.message);
  }

  // -----------------------------------------------------------------
  // 5. Admin Authentication & Management Portal
  // -----------------------------------------------------------------
  console.log(`\n[Group 5: Admin Authentication & Data Endpoints]`);
  // Test: Reject bad credentials
  try {
    const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sukoon.crystalsolutions@gmail.com', password: 'WrongPassword123' }),
    });
    assert(badLoginRes.status === 401, 'Invalid admin password rejected with 401 Unauthorized');
  } catch (e) {
    assert(false, 'Bad login rejection test failed', e.message);
  }

  // Test: Accept correct credentials
  try {
    const goodLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sukoon.crystalsolutions@gmail.com', password: 'Fundo@987654' }),
    });
    assert(goodLoginRes.status === 200, 'Admin login with Fundo@987654 returns 200 OK');
    const loginData = await goodLoginRes.json();
    assert(Boolean(loginData.token), 'Admin JWT token issued successfully');
    adminToken = loginData.token;
  } catch (e) {
    assert(false, 'Admin login test failed', e.message);
  }

  if (adminToken) {
    // Test: GET /api/auth/me
    try {
      const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK with token');
    } catch (e) {
      assert(false, 'GET /api/auth/me failed', e.message);
    }

    // Test: GET /api/orders (the endpoint that previously crashed)
    try {
      const ordersRes = await fetch(`${BASE_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(ordersRes.status === 200, 'GET /api/orders returns 200 OK');
      const orders = await ordersRes.json();
      assert(Array.isArray(orders), 'GET /api/orders returns valid array');
    } catch (e) {
      assert(false, 'GET /api/orders failed', e.message);
    }

    // Test: GET /api/bookings
    try {
      const bookingsRes = await fetch(`${BASE_URL}/api/bookings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(bookingsRes.status === 200, 'GET /api/bookings returns 200 OK');
      const bookings = await bookingsRes.json();
      assert(Array.isArray(bookings), 'GET /api/bookings returns valid array');
    } catch (e) {
      assert(false, 'GET /api/bookings failed', e.message);
    }

    // Test: GET /api/analytics/summary
    try {
      const analyticsRes = await fetch(`${BASE_URL}/api/analytics/summary?days=30`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(analyticsRes.status === 200, 'GET /api/analytics/summary returns 200 OK');
      const analytics = await analyticsRes.json();
      assert(Boolean(analytics.today && analytics.series), 'Analytics dashboard data is complete');
    } catch (e) {
      assert(false, 'GET /api/analytics/summary failed', e.message);
    }
  }

  // -----------------------------------------------------------------
  // 6. Test Suite Summary
  // -----------------------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`  Test Suite Completed`);
  console.log(`  Total Tests Run : ${totalTests}`);
  console.log(`  Passed          : ${passedTests}`);
  console.log(`  Failed          : ${failedTests}`);
  console.log(`======================================================\n`);

  if (failedTests > 0) {
    console.error('Failed tests summary:');
    failures.forEach((f) => console.error(` - ${f.testName}: ${f.details}`));
    process.exit(1);
  } else {
    console.log('🎉 ALL TEST CASES PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
