import './env.js';
import fs from 'fs';
import { getPool } from './postgres.js';

async function importHistorical() {
  const pool = getPool();
  const backup = JSON.parse(
    fs.readFileSync('server/data/db.pre-migration.1790933993516.json', 'utf8')
  );

  console.log('--- Importing Historical Orders & Bookings into Neon ---');

  // 1. Orders
  const orders = backup.orders || [];
  console.log(`Found ${orders.length} orders to import...`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const ord of orders) {
      await client.query(
        `INSERT INTO "orders" (key, doc) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET doc = excluded.doc, updated_at = now()`,
        [ord.id, JSON.stringify(ord)]
      );
    }
    await client.query('COMMIT');
    console.log(`Successfully imported ${orders.length} orders into Neon!`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to import orders:', err);
  }

  // 2. Bookings
  const bookings = backup.bookings || [];
  console.log(`Found ${bookings.length} bookings to import...`);
  try {
    await client.query('BEGIN');
    for (const bkg of bookings) {
      await client.query(
        `INSERT INTO "bookings" (key, doc) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET doc = excluded.doc, updated_at = now()`,
        [bkg.id, JSON.stringify(bkg)]
      );
    }
    await client.query('COMMIT');
    console.log(`Successfully imported ${bookings.length} bookings into Neon!`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to import bookings:', err);
  } finally {
    client.release();
  }

  // Verify counts
  const ordCount = await pool.query('SELECT count(*) FROM "orders"');
  const bkgCount = await pool.query('SELECT count(*) FROM "bookings"');
  console.log(`\nVerified Neon DB counts:`);
  console.log(`  Orders:   ${ordCount.rows[0].count}`);
  console.log(`  Bookings: ${bkgCount.rows[0].count}`);

  process.exit(0);
}

importHistorical().catch((err) => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
