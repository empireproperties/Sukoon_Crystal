/* The colourway ids the storefront can actually render.
 *
 * The real definitions live in client/src/theme/designs.js — this is a copy of
 * just the ids, because the API deploys from server/ alone (see DEPLOY.md) and
 * cannot reach across into the client folder at runtime. Keep the two in step:
 * an id here that the CSS does not define renders an unstyled page.
 *
 * The server needs the list for one job only: a settings row written before a
 * colourway was renamed or retired must not leave the shop with a palette that
 * no longer exists. Anything unrecognised falls back to DEFAULT_PALETTE.
 */

/** Taken hex for hex from client/src/assets/logo.jpeg — the brand mark itself. */
export const DEFAULT_PALETTE = 'sukoon-signature';

/** Only one page template survived; kept as a constant for the same reason. */
export const DEFAULT_DESIGN = 'gallery';

export const PALETTE_IDS = [
  'sukoon-signature',
  'alabaster-gold',
  'ivory-emerald',
  'blush-ruby',
  'linen-terracotta',
  'pearl-plum',
  'sukoon-night',
  'obsidian-gold',
  'forest-gold',
  'wine-rose',
];

export const isLivePalette = (id) => PALETTE_IDS.includes(id);
