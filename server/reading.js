/**
 * Turns the raw Vedic chart into something a person can read, and into stones
 * we actually stock.
 *
 * Everything here is derived from the chart the API returned — no second call,
 * no invention. That matters twice over: the free plan is only 80 requests a
 * day, and a reading that quietly made things up would be worse than none.
 *
 * The tone is deliberately grounded. This is offered as a welcome and a
 * starting point for a conversation with Swati, not as advice about health,
 * money or anything a person should be deciding on a web page.
 */

/* --------------------------------------------------------------- the signs */
/* `lagna` is who the chart says you are to the world; `moon` is the inner
   weather. Both are one sentence, because twelve paragraphs nobody reads is
   worse than twelve sentences everybody does. */
const SIGNS = {
  1:  { name: 'Aries', sanskrit: 'Mesha', lord: 'Mars', element: 'Fire',
        lagna: 'You start things. Directness is your gift and your cost — you would rather move and correct course than wait and be sure.',
        moon: 'Your feelings arrive fast and clean, and they pass just as quickly once you have said them out loud.' },
  2:  { name: 'Taurus', sanskrit: 'Vrishabha', lord: 'Venus', element: 'Earth',
        lagna: 'You build slowly and you build to last. Comfort, beauty and steadiness are not indulgences for you — they are how you stay strong.',
        moon: 'You settle when your surroundings settle. Familiar things, good food and unhurried mornings do more for you than any pep talk.' },
  3:  { name: 'Gemini', sanskrit: 'Mithuna', lord: 'Mercury', element: 'Air',
        lagna: 'You think in several directions at once and you talk your way to clarity. Curiosity keeps you young and occasionally keeps you up at night.',
        moon: 'You process feeling through words. Left unspoken, a small worry will circle for days; said aloud, it usually shrinks.' },
  4:  { name: 'Cancer', sanskrit: 'Karka', lord: 'Moon', element: 'Water',
        lagna: 'You look after people, often before they have asked. Your memory for how something felt is longer than most people’s memory for what happened.',
        moon: 'You feel everything in the room, including what nobody said. Home, water and rest are not luxuries for you — they are maintenance.' },
  5:  { name: 'Leo', sanskrit: 'Simha', lord: 'Sun', element: 'Fire',
        lagna: 'You carry warmth into a room and people orient around it. Being seen matters to you, and there is no shame in that.',
        moon: 'You steady when you are appreciated and wobble in silence. A little genuine recognition goes a long way.' },
  6:  { name: 'Virgo', sanskrit: 'Kanya', lord: 'Mercury', element: 'Earth',
        lagna: 'You notice the detail everyone else walked past. Useful, exacting, and hard on yourself in a way you would never be on a friend.',
        moon: 'Order calms you. When life is unsettled you tidy something small, and it genuinely helps.' },
  7:  { name: 'Libra', sanskrit: 'Tula', lord: 'Venus', element: 'Air',
        lagna: 'You weigh things. Fairness and grace matter to you, and you will hold a decision open longer than most to get it right.',
        moon: 'Discord sits heavily on you. You are at ease when the people around you are at ease with each other.' },
  8:  { name: 'Scorpio', sanskrit: 'Vrishchika', lord: 'Mars', element: 'Water',
        lagna: 'You go deep or you do not go. Surfaces bore you, intensity does not frighten you, and you keep your own counsel.',
        moon: 'You feel privately and thoroughly. What you have decided not to speak about is usually the thing carrying the most weight.' },
  9:  { name: 'Sagittarius', sanskrit: 'Dhanu', lord: 'Jupiter', element: 'Fire',
        lagna: 'You need somewhere to be going. Belief, travel and the bigger picture keep you honest; small print does not.',
        moon: 'Optimism is your resting state, and confinement is what genuinely unsettles you.' },
  10: { name: 'Capricorn', sanskrit: 'Makara', lord: 'Saturn', element: 'Earth',
        lagna: 'You are built for the long climb. Responsibility found you early and you have carried it well, often without being asked how it feels.',
        moon: 'You steady yourself through work and structure. Rest has to be scheduled or it does not happen.' },
  11: { name: 'Aquarius', sanskrit: 'Kumbha', lord: 'Saturn', element: 'Air',
        lagna: 'You stand a step outside and see the pattern. Independent, principled, and not much moved by what everyone else is doing.',
        moon: 'You need room. Closeness suits you best when it comes without a claim on your freedom.' },
  12: { name: 'Pisces', sanskrit: 'Meena', lord: 'Jupiter', element: 'Water',
        lagna: 'You absorb the mood of things. Imaginative and quietly kind, with a boundary problem you have probably been told about.',
        moon: 'You feel other people’s weather as your own. Learning where you end is the work of your life, and it is worth it.' },
};

/* ---------------------------------------------------------- the nakshatras */
/* The birth star. In practice this is the line people screenshot. */
const NAKSHATRAS = {
  'Ashwini':            'The healer who arrives quickly. Fresh starts, speed, and a restlessness that wants to be useful.',
  'Bharani':            'You carry things through — endings, beginnings and everything heavy in between. Endurance is your signature.',
  'Krittika':           'A cutting clarity. You see what is true and you say it, which people thank you for later rather than at the time.',
  'Rohini':             'Beauty gathers around you. Growth, comfort and an eye for what is genuinely lovely.',
  'Mrigashira':         'The seeker. Always half-looking for something better, which keeps life interesting and rest difficult.',
  'Ardra':              'Storm and clearing. You are remade by the hard passages rather than broken by them.',
  'Punarvasu':          'The return. Whatever is lost finds its way back to you, usually in better shape.',
  'Pushya':             'The most nourishing star. People come to you to be steadied, and you are good at it.',
  'Ashlesha':           'Insight that goes right to the bone. You read people accurately and you know when not to say so.',
  'Magha':              'Ancestry and dignity. You carry something forward from those who came before you.',
  'Purva Phalguni':     'Ease, pleasure and warmth. You make life feel good and you are not apologetic about it.',
  'Uttara Phalguni':    'Generous and dependable. Your word holds, and people build on it.',
  'Hasta':              'Skilled hands. What you make, you make well, and craft settles you.',
  'Chitra':             'The artisan. Design, brilliance and a real need for beauty in your surroundings.',
  'Swati':              'Independent as wind. You bend rather than break, and you do not do well caged.',
  'Vishakha':           'Focused desire. You want, you aim and you arrive — often just after you had given up.',
  'Anuradha':           'Devotion and friendship. You keep people, across distance and years.',
  'Jyeshtha':           'The elder. Responsibility landed on you early and you have quietly borne it.',
  'Mula':               'Down to the root. You pull things up to see what they were really standing on.',
  'Purva Ashadha':      'Unbeatable optimism. You do not stay down, and it lifts everyone near you.',
  'Uttara Ashadha':     'The final victory. Slow, principled, and you finish what you started.',
  'Shravana':           'The listener. You learn by hearing, and people tell you things they had not planned to.',
  'Dhanishta':          'Rhythm and prosperity. You keep time for others and you do well when you keep it for yourself.',
  'Shatabhisha':        'The hundred healers. Private, unconventional, drawn to what mends people.',
  'Purva Bhadrapada':   'Fire and depth. Intense, otherworldly, not made for shallow company.',
  'Uttara Bhadrapada':  'Deep still water. Wisdom, patience and a calm others borrow from.',
  'Revati':             'The safe crossing. Gentle, protective, and the one who sees people home.',
};

/* ------------------------------------------------------------ dignities */
const DEBILITATED = { Sun: 7, Moon: 8, Mars: 4, Mercury: 12, Jupiter: 10, Venus: 6, Saturn: 1 };
const EXALTED     = { Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 };
const SIGN_LORD = {
  1: 'Mars', 2: 'Venus', 3: 'Mercury', 4: 'Moon', 5: 'Sun', 6: 'Mercury',
  7: 'Venus', 8: 'Mars', 9: 'Jupiter', 10: 'Saturn', 11: 'Saturn', 12: 'Jupiter',
};

/* Houses where a heavy planet is traditionally read as asking for support.
   Not "bad" — the copy never says bad. Asking for support. */
const TENDER_HOUSES = new Set([1, 4, 7, 8, 12]);

/**
 * Graha to crystal. These are the working substitutes an Indian crystal
 * practice actually uses — not the ratna a jeweller would sell you — matched
 * against the stone names in our own catalogue.
 */
const GRAHA_STONES = {
  Sun:     { stones: ['Citrine', 'Sunstone', 'Carnelian', 'Red Jasper'], for: 'confidence, vitality and being seen clearly' },
  Moon:    { stones: ['Moonstone', 'Selenite', 'Rose Quartz', 'Clear Quartz'], for: 'calm, sleep and steadier feeling' },
  Mars:    { stones: ['Red Jasper', 'Carnelian', 'Hematite', 'Black Tourmaline'], for: 'courage held steady rather than spent in temper' },
  Mercury: { stones: ['Green Aventurine', 'Amazonite', 'Fluorite'], for: 'clear thinking, speech and study' },
  Jupiter: { stones: ['Citrine', 'Yellow Calcite', 'Lapis Lazuli'], for: 'wisdom, growth and good counsel' },
  Venus:   { stones: ['Rose Quartz', 'Opal', 'Howlite', 'Clear Quartz'], for: 'love, ease and self-worth' },
  Saturn:  { stones: ['Black Tourmaline', 'Black Onyx', 'Amethyst', 'Hematite'], for: 'protection, patience and carrying weight without it carrying you' },
  Rahu:    { stones: ['Agate', 'Tiger Eye', 'Black Obsidian'], for: 'grounding when life speeds up unexpectedly' },
  Ketu:    { stones: ['Tiger Eye', 'Fluorite', 'Sphtik', 'Clear Quartz'], for: 'clarity, detachment and quiet' },
};

const num = (n) => Number(n || 0);
const round1 = (n) => Math.round(num(n) * 10) / 10;

/* ------------------------------------------------------------------ build */

/**
 * @param {object} chart  the raw /api/v2/vedic/chart response
 * @returns a reading, plus the stone keywords used to pick products
 */
export function buildReading(chart) {
  const planets = chart?.planets || [];
  const byName = Object.fromEntries(planets.map((p) => [p.name, p]));
  const asc = chart?.ascendant || {};

  const ascSign = SIGNS[asc.sign_id] || null;
  const moon = byName.Moon;
  const sun = byName.Sun;
  const moonSign = moon ? SIGNS[moon.sign_id] : null;
  const sunSign = sun ? SIGNS[sun.sign_id] : null;

  const star = asc?.nakshatra?.name || '';
  const moonStar = moon?.nakshatra || '';

  /* Which grahas are asking for support. Scored, so the reasons we show are
     the real ones rather than a fixed list dressed up as personal. */
  const scores = {};
  const reasons = {};
  const flag = (graha, points, why) => {
    if (!GRAHA_STONES[graha]) return;
    scores[graha] = (scores[graha] || 0) + points;
    (reasons[graha] = reasons[graha] || []).push({ why, points });
  };

  for (const p of planets) {
    if (DEBILITATED[p.name] === p.sign_id) {
      flag(p.name, 5, `${p.name} sits in ${SIGNS[p.sign_id]?.name}, its sign of least comfort`);
    }
    if (TENDER_HOUSES.has(num(p.house)) && ['Saturn', 'Mars', 'Rahu', 'Ketu'].includes(p.name)) {
      flag(p.name, 3, `${p.name} falls in your ${ordinal(p.house)} house, a placement that asks for steadying`);
    }
    if (p.is_retrograde && ['Mercury', 'Mars', 'Saturn'].includes(p.name)) {
      flag(p.name, 2, `${p.name} was retrograde at your birth, so its work turns inward`);
    }
  }

  if (chart?.sade_sati?.active) {
    flag('Saturn', 6, 'you are passing through Sade Sati, Saturn’s long teaching cycle');
  }

  /* The lagna lord always belongs in the answer — it runs the whole chart. */
  const lagnaLord = SIGN_LORD[asc.sign_id];
  if (lagnaLord) flag(lagnaLord, 4, `${lagnaLord} rules your ascendant, so it sets the tone of the whole chart`);

  const starLord = asc?.nakshatra?.lord;
  if (starLord) flag(starLord, 2, `${starLord} rules ${star}, your birth star`);

  /* The reason shown is the heaviest one, not whichever rule happened to run
     first — "rules your ascendant" is a better answer than "was retrograde",
     and a reader who is told the lesser fact assumes we found nothing more. */
  const support = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([graha]) => {
      const ranked = [...reasons[graha]].sort((a, b) => b.points - a.points);
      return {
        graha,
        why: ranked[0].why,
        alsoBecause: ranked.slice(1).map((r) => r.why),
        helps: GRAHA_STONES[graha].for,
        stones: GRAHA_STONES[graha].stones,
      };
    });

  return {
    /* Their own rashi, so the zodiac pieces recommended below are theirs. In
       Vedic practice the sign that counts is the moon's, not the sun's. */
    rashi: moonSign?.name || '',
    lagna: ascSign && {
      sign: ascSign.name, sanskrit: ascSign.sanskrit, lord: ascSign.lord,
      element: ascSign.element, degree: round1(asc.degree), text: ascSign.lagna,
    },
    moon: moonSign && {
      sign: moonSign.name, sanskrit: moonSign.sanskrit, house: moon.house,
      text: moonSign.moon, nakshatra: moonStar, pada: moon.pada,
      starText: NAKSHATRAS[moonStar] || '',
    },
    sun: sunSign && { sign: sunSign.name, sanskrit: sunSign.sanskrit, house: sun.house },
    nakshatra: star && {
      name: star, pada: asc?.nakshatra?.pada, lord: asc?.nakshatra?.lord,
      text: NAKSHATRAS[star] || '',
    },
    sadeSati: {
      active: Boolean(chart?.sade_sati?.active),
      phase: chart?.sade_sati?.phase || '',
      text: chart?.sade_sati?.active
        ? 'Saturn is currently moving through the stretch around your moon that tradition calls Sade Sati. It is read as a demanding, clarifying period rather than a misfortune — the years people say made them.'
        : 'You are not in Sade Sati at the moment. Saturn is working elsewhere in your chart.',
    },
    placements: planets.map((p) => ({
      name: p.name,
      sign: SIGNS[p.sign_id]?.name || p.sign,
      house: p.house,
      degree: round1(p.degree_in_sign),
      nakshatra: p.nakshatra,
      retrograde: Boolean(p.is_retrograde),
      dignity: EXALTED[p.name] === p.sign_id ? 'exalted'
        : DEBILITATED[p.name] === p.sign_id ? 'debilitated' : '',
    })),
    support,
    stoneKeywords: [...new Set(support.flatMap((s) => s.stones))],
  };
}

function ordinal(n) {
  const v = num(n);
  const s = ['th', 'st', 'nd', 'rd'][(v % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][v % 100] || 'th';
  return `${v}${s}`;
}

/**
 * Picks real products for the reading. Matches on the stone names already
 * written on each product, so nothing is recommended that we cannot ship, and
 * the shop stays the source of truth rather than a hardcoded list.
 */
const ZODIAC = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

export function recommendProducts(reading, products, limit = 6) {
  const wanted = reading.stoneKeywords.map((s) => s.toLowerCase());
  if (!wanted.length) return [];

  const mine = (reading.rashi || '').toLowerCase();

  const scored = [];
  for (const p of products) {
    if (p.active === false || p.stock === 0) continue;
    const hay = `${p.stone || ''} ${p.name || ''}`.toLowerCase();

    /* A piece named for a sign belongs to that sign. Offering a Gemini the
       Scorpio bracelet because the beads happen to match undoes the trust the
       reading just built — it reads as a shop that did not look at the chart. */
    const namedSign = ZODIAC.find((z) => hay.includes(z));
    if (namedSign && namedSign !== mine) continue;

    const hits = wanted.filter((w) => hay.includes(w));
    if (!hits.length && !namedSign) continue;

    /* Bestsellers break ties — of two equally suitable pieces, show the one
       people actually keep coming back for. Their own rashi piece leads. */
    scored.push({
      p,
      score: hits.length * 10 + (namedSign === mine ? 25 : 0) + (p.bestseller ? 2 : 0) + (p.rating || 0),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p }) => ({
      id: p.id, slug: p.slug, name: p.name, stone: p.stone,
      price: p.price, mrp: p.mrp, images: p.images || [], image: p.images?.[0] || '',
      stock: p.stock, bestseller: p.bestseller, category: p.category, rating: p.rating,
    }));
}
