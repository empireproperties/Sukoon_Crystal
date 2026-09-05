/**
 * ONE TEMPLATE · EIGHT COLOURWAYS
 *
 * There used to be four page templates. They were a pitch device — the store
 * now has one homepage, one header and one product card, so keeping four
 * skeletons meant maintaining three that nobody would ever publish. The
 * surviving one is `gallery`: Marcellus display face, square corners, a wide
 * measure and cinematic spacing.
 *
 * What is actually worth changing is colour, so that is where the choice lives:
 * five light colourways and three dark. Every component reads tokens rather
 * than raw hex, so a colourway swap needs no component change.
 */

const P = (id, name, tone, swatch, note) => ({ id, name, tone, swatch, note });

export const DESIGN = {
  id: 'gallery',
  name: 'Sukoon',
  type: 'Marcellus · Inter',
  corners: 'Square',
  density: 'Cinematic',

  palettes: [
    /* ---------------------------------------------------------- light ---- */
    P('alabaster-gold', 'Alabaster & Gold', 'light',
      ['#f7f5f0', '#ffffff', '#1c1b18', '#9c7c3c'],
      'Warm ivory and antique gold. The quietest option — lets the product photography carry all the colour.'),

    P('ivory-emerald', 'Ivory & Emerald', 'light',
      ['#fbfaf6', '#ffffff', '#14211b', '#0f3126'],
      'Taken straight from the logo: the disc green and its gold foil. The closest match to the brand mark.'),

    P('blush-ruby', 'Blush & Ruby', 'light',
      ['#fdf9f7', '#ffffff', '#2a1418', '#9e1f34'],
      'Soft blush ground with a deep ruby. Festive without shouting — reads well for Diwali and wedding season.'),

    P('linen-terracotta', 'Linen & Terracotta', 'light',
      ['#fbf6f0', '#ffffff', '#2c1a12', '#b1552c'],
      'Sand and burnt earth. Warm and grounded, and it flatters the rudraksha and jasper photography.'),

    P('pearl-plum', 'Pearl & Plum', 'light',
      ['#faf8fb', '#ffffff', '#221726', '#6b2f5e'],
      'Cool pearl with a deep plum. The most modern of the light set.'),

    /* ----------------------------------------------------------- dark ---- */
    P('obsidian-gold', 'Obsidian & Gold', 'dark',
      ['#0e0e10', '#17171a', '#f0ede6', '#c9a961'],
      'Near-black and gold. The most luxurious, and the strongest frame for bright stones.'),

    P('forest-gold', 'Forest & Gold', 'dark',
      ['#0c1f18', '#123027', '#eaf1ec', '#d9ae59'],
      'The logo green as the whole page, lit by its own gold. Dramatic and unmistakably Sukoon.'),

    P('wine-rose', 'Wine & Rose', 'dark',
      ['#1a0f13', '#251419', '#f7ebe9', '#d08a72'],
      'Deep wine with a rose-gold accent. Rich and warm for a festive campaign.'),
  ],
};

export const PALETTES = DESIGN.palettes;
export const PALETTE_IDS = PALETTES.map((p) => p.id);
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
  (PALETTE_IDS.includes(id) ? id : LEGACY[id]) || PALETTES[0].id;

/** Kept for the store, which stamps both attributes on <html>. */
export function normalise(_designId, paletteId) {
  const palette = getPalette(normalisePalette(paletteId));
  return { design: { id: DESIGN.id, name: DESIGN.name }, palette };
}

/* Older imports expect these shapes. */
export const DESIGNS = [DESIGN];
export const DESIGN_IDS = [DESIGN.id];
export const getDesign = () => DESIGN;
