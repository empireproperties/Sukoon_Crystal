/**
 * ONE TEMPLATE · TEN COLOURWAYS
 *
 * There used to be four page templates. They were a pitch device — the store
 * now has one homepage, one header and one product card, so keeping four
 * skeletons meant maintaining three that nobody would ever publish. The
 * surviving one is `gallery`: Marcellus display face, square corners, a wide
 * measure and cinematic spacing.
 *
 * What is actually worth changing is colour, so that is where the choice lives:
 * six light colourways and four dark. Every component reads tokens rather
 * than raw hex, so a colourway swap needs no component change.
 *
 * THE BRAND COLOURS
 * -----------------
 * Sampled from client/src/assets/logo.jpeg, which is the master artwork:
 *
 *   green   #2a513c   the disc
 *   gold    #d4af16   the lettering, the sprig and the bracelet
 *   ivory   #f5f4f0   the ground the disc sits on
 *
 * Those three hexes appear verbatim in the two `sukoon-*` colourways below,
 * with one deliberate exception noted on `--c-accent` in index.css: the foil
 * gold is 1.9:1 against ivory, which is unreadable as text, so light mode
 * writes in a darkened gold of the same hue and keeps the true foil for fills.
 */

/* swatch = [bg, surface, ink, accent, brand] — the five colours the Appearance
   screen paints, in the order it paints them. */
const P = (id, name, tone, swatch, note) => ({ id, name, tone, swatch, note });

export const DESIGN = {
  id: 'gallery',
  name: 'Sukoon',
  type: 'Marcellus · Inter',
  corners: 'Square',
  density: 'Cinematic',

  palettes: [
    /* ---------------------------------------------------------- light ---- */

    /* First in the list, which is what makes it the fallback everywhere:
       getPalette() and normalisePalette() both land here when an id is
       missing or unrecognised. */
    P('sukoon-signature', 'Sukoon Signature', 'light',
      ['#f5f4f0', '#ffffff', '#14251c', '#8a7015', '#2a513c'],
      'The logo, exactly. Its disc green, its foil gold and the ivory it sits on, straight off the artwork.'),

    P('alabaster-gold', 'Alabaster & Gold', 'light',
      ['#f7f5f0', '#ffffff', '#1c1b18', '#9c7c3c', '#1c1b18'],
      'Warm ivory and antique gold. The quietest option — lets the product photography carry all the colour.'),

    P('ivory-emerald', 'Ivory & Emerald', 'light',
      ['#fbfaf6', '#ffffff', '#14211b', '#a8842c', '#0f3126'],
      'A deeper, cooler emerald than the mark itself. Pick Sukoon Signature instead if you want the exact logo green.'),

    P('blush-ruby', 'Blush & Ruby', 'light',
      ['#fdf9f7', '#ffffff', '#2a1418', '#a8763f', '#9e1f34'],
      'Soft blush ground with a deep ruby. Festive without shouting — reads well for Diwali and wedding season.'),

    P('linen-terracotta', 'Linen & Terracotta', 'light',
      ['#fbf6f0', '#ffffff', '#2c1a12', '#a07434', '#b1552c'],
      'Sand and burnt earth. Warm and grounded, and it flatters the rudraksha and jasper photography.'),

    P('pearl-plum', 'Pearl & Plum', 'light',
      ['#faf8fb', '#ffffff', '#221726', '#9a7440', '#6b2f5e'],
      'Cool pearl with a deep plum. The most modern of the light set.'),

    /* ----------------------------------------------------------- dark ---- */

    P('sukoon-night', 'Sukoon Signature Dark', 'dark',
      ['#2a513c', '#315e46', '#f5f4f0', '#d4af16', '#d4af16'],
      'The same three brand colours after dark: the page is the disc green itself, lettered in the foil gold.'),

    P('obsidian-gold', 'Obsidian & Gold', 'dark',
      ['#0e0e10', '#17171a', '#f0ede6', '#c9a961', '#c9a961'],
      'Near-black and gold. The most luxurious, and the strongest frame for bright stones.'),

    P('forest-gold', 'Forest & Gold', 'dark',
      ['#0c1f18', '#123027', '#eaf1ec', '#d9ae59', '#d9ae59'],
      'A darker, colder green than the mark. Dramatic, but Sukoon Signature Dark is the faithful one.'),

    P('wine-rose', 'Wine & Rose', 'dark',
      ['#1a0f13', '#251419', '#f7ebe9', '#d08a72', '#d08a72'],
      'Deep wine with a rose-gold accent. Rich and warm for a festive campaign.'),
  ],
};

export const PALETTES = DESIGN.palettes;
export const PALETTE_IDS = PALETTES.map((p) => p.id);

/** The colourway a fresh install, an unknown id and a blank settings row all
 *  get. Kept as a named export so the server can agree with us — see
 *  server/theme.js, which must be edited in step with this file. */
export const DEFAULT_PALETTE = PALETTES[0].id;

export const getPalette = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

/* Ids from the four-template era map onto the nearest surviving colourway, so a
   settings row written before this change still resolves to something real. */
const LEGACY = {
  bone: 'alabaster-gold', clay: 'linen-terracotta', sage: 'ivory-emerald',
  ink: 'obsidian-gold', slate: 'obsidian-gold',
  'ivory-gold': 'alabaster-gold', 'champagne-burgundy': 'blush-ruby',
  'pearl-navy': 'pearl-plum', 'wine-champagne': 'wine-rose',
  'sand-charcoal': 'alabaster-gold', 'paper-cobalt': 'pearl-plum',
  'chalk-forest': 'ivory-emerald', 'graphite-amber': 'obsidian-gold',
  'midnight-mint': 'forest-gold', 'mist-rose': 'blush-ruby',
  'linen-jade': 'ivory-emerald', 'espresso-cream': 'wine-rose',
};

export const normalisePalette = (id) =>
  (PALETTE_IDS.includes(id) ? id : LEGACY[id]) || DEFAULT_PALETTE;

/** Kept for the store, which stamps both attributes on <html>. */
export function normalise(_designId, paletteId) {
  const palette = getPalette(normalisePalette(paletteId));
  return { design: { id: DESIGN.id, name: DESIGN.name }, palette };
}

/* Older imports expect these shapes. */
export const DESIGNS = [DESIGN];
export const DESIGN_IDS = [DESIGN.id];
export const getDesign = () => DESIGN;
