/* Loads server/.env before anything reads process.env.
 *
 * ES module imports are hoisted and evaluated in declaration order, so any
 * module that reads an env var at module scope would see it unset if the file
 * were loaded inline. Importing this module FIRST is what makes .env reliable.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  /* No .env is fine -- everything falls back to defaults. */
}
export const loaded = true;
