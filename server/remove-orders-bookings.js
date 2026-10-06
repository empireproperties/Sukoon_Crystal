import './env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const pool = getPool();
  console.log('--- Removing 393 Demo Orders and 34 Demo Bookings from Neon ---');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const delOrders = await client.query('DELETE FROM "orders"');
    console.log(`Deleted ${delOrders.rowCount} rows from "orders" table.`);

    const delBookings = await client.query('DELETE FROM "bookings"');
    console.log(`Deleted ${delBookings.rowCount} rows from "bookings" table.`);

    // Reset sold count to 0 for products since orders were removed
    const prodsRes = await client.query('SELECT key, doc FROM "products"');
    for (const row of prodsRes.rows) {
      if (row.doc.sold > 0) {
        row.doc.sold = 0;
        await client.query('UPDATE "products" SET doc = $1 WHERE key = $2', [JSON.stringify(row.doc), row.key]);
      }
    }
    console.log(`Reset sold counters to 0 across products.`);

    await client.query('COMMIT');
    console.log('Successfully committed transaction to Neon PostgreSQL!');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to remove data:', err);
    process.exit(1);
  } finally {
    client.release();
  }

  // Update local db.json
  const dbFile = path.join(__dirname, 'data', 'db.json');
  if (fs.existsSync(dbFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
      data.orders = [];
      data.bookings = [];
      (data.products || []).forEach(p => { p.sold = 0; });
      fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
      console.log('Updated local server/data/db.json.');
    } catch {}
  }

  // Verify counts
  const ordCount = await pool.query('SELECT count(*) FROM "orders"');
  const bkgCount = await pool.query('SELECT count(*) FROM "bookings"');
  console.log(`\nVerified Neon DB counts:`);
  console.log(`  Orders:   ${ordCount.rows[0].count}`);
  console.log(`  Bookings: ${bkgCount.rows[0].count}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
