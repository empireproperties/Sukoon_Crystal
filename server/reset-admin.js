/* Admin password recovery. There is no "forgot password" email flow, so this
 * is how you get back in -- it needs shell access to the server, which is the
 * point.
 *
 *   node reset-admin.js                          # random password, printed once
 *   node reset-admin.js --email a@b.com          # pick the account
 *   node reset-admin.js --password 'MyOwn123Pw'  # set a known one
 *   node reset-admin.js --list                   # who can sign in
 *
 * Resetting bumps `epoch`, so every token already issued stops working.
 */
import './env.js';
import crypto from 'crypto';
import { initDb, closeDb, db, saveNow, uid } from './db.js';
import { hashPassword, passwordProblem } from './auth.js';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const str = (f) => {
  const i = argv.indexOf(`--${f}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};

const info = await initDb();
console.log(`\n  store: ${info.mode}${info.db ? ` (${info.db})` : ''}`);

const admins = db.admins || [];

if (has('list')) {
  if (!admins.length) console.log('  no admin accounts yet -- start the server once to create one.\n');
  else {
    console.log(`  ${admins.length} admin account(s):\n`);
    for (const a of admins) {
      console.log(`    ${a.email}`);
      console.log(`      name ${a.name} | active ${a.active !== false} | last login ${a.lastLoginAt || 'never'}`);
    }
    console.log('');
  }
  await closeDb();
  process.exit(0);
}

const email = (str('email') || admins[0]?.email || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
if (!email) {
  console.error('  No admin to reset and no --email given.\n');
  await closeDb();
  process.exit(1);
}

const supplied = str('password');
if (supplied) {
  const problem = passwordProblem(supplied);
  if (problem) {
    console.error(`  ${problem}\n`);
    await closeDb();
    process.exit(1);
  }
}
const password = supplied || `Sukoon-${crypto.randomBytes(9).toString('base64url')}`;
const passwordHash = await hashPassword(password);

const existing = admins.find((a) => a.email === email);
if (existing) {
  db.admins = admins.map((a) =>
    a.id === existing.id
      ? { ...a, passwordHash, epoch: (a.epoch || 0) + 1, active: true,
          mustChangePassword: !supplied, passwordChangedAt: new Date().toISOString() }
      : a
  );
  console.log(`  reset the password for ${email}`);
} else {
  db.admins = [...admins, {
    id: uid('adm'), email, name: str('name') || 'Administrator', passwordHash,
    epoch: 0, active: true, createdAt: new Date().toISOString(), mustChangePassword: !supplied,
  }];
  console.log(`  created a new admin ${email}`);
}

await saveNow();
await closeDb();

console.log('\n  ┌─ SIGN IN WITH ────────────────────────────────────────');
console.log(`  │  email    ${email}`);
console.log(`  │  password ${password}`);
console.log(`  │  ${supplied ? 'You chose this password.' : 'Shown once. Change it after signing in.'}`);
console.log('  └───────────────────────────────────────────────────────');
console.log('  Every previously issued admin token is now invalid.\n');
