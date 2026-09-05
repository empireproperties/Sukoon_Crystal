/** Shared reference data and a few small, quiet decorative pieces. */

export const ZODIAC = [
  { id: 'aries', glyph: '♈', name: 'Aries', dates: 'Mar 21 – Apr 19', element: 'Fire' },
  { id: 'taurus', glyph: '♉', name: 'Taurus', dates: 'Apr 20 – May 20', element: 'Earth' },
  { id: 'gemini', glyph: '♊', name: 'Gemini', dates: 'May 21 – Jun 20', element: 'Air' },
  { id: 'cancer', glyph: '♋', name: 'Cancer', dates: 'Jun 21 – Jul 22', element: 'Water' },
  { id: 'leo', glyph: '♌', name: 'Leo', dates: 'Jul 23 – Aug 22', element: 'Fire' },
  { id: 'virgo', glyph: '♍', name: 'Virgo', dates: 'Aug 23 – Sep 22', element: 'Earth' },
  { id: 'libra', glyph: '♎', name: 'Libra', dates: 'Sep 23 – Oct 22', element: 'Air' },
  { id: 'scorpio', glyph: '♏', name: 'Scorpio', dates: 'Oct 23 – Nov 21', element: 'Water' },
  { id: 'sagittarius', glyph: '♐', name: 'Sagittarius', dates: 'Nov 22 – Dec 21', element: 'Fire' },
  { id: 'capricorn', glyph: '♑', name: 'Capricorn', dates: 'Dec 22 – Jan 19', element: 'Earth' },
  { id: 'aquarius', glyph: '♒', name: 'Aquarius', dates: 'Jan 20 – Feb 18', element: 'Air' },
  { id: 'pisces', glyph: '♓', name: 'Pisces', dates: 'Feb 19 – Mar 20', element: 'Water' },
];

export const CHAKRAS = [
  { name: 'Root', colour: '#b4503c' },
  { name: 'Sacral', colour: '#c47a35' },
  { name: 'Solar Plexus', colour: '#b99a2e' },
  { name: 'Heart', colour: '#4a8a5f' },
  { name: 'Throat', colour: '#3d7fa3' },
  { name: 'Third Eye', colour: '#4b5296' },
  { name: 'Crown', colour: '#7a5b9c' },
];

export function ChakraDot({ name, size = 8 }) {
  const c = CHAKRAS.find((x) => x.name === name);
  if (!c) return null;
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: c.colour }}
      title={`${c.name} chakra`}
      aria-hidden="true"
    />
  );
}

/** Small monogram used as the brand mark across all three themes. */
export function Monogram({ size = 36, className = '' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center bg-brand font-display leading-none text-onbrand ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5, borderRadius: 'var(--r-btn)' }}
      aria-hidden="true"
    >
      S
    </span>
  );
}

export function Stars({ rating = 5, size = 12, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-px ${className}`} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M10 1.6l2.5 5.2 5.7.8-4.1 4 1 5.7L10 14.6 4.9 17.3l1-5.7-4.1-4 5.7-.8z"
            fill={i < Math.round(rating) ? 'var(--c-accent)' : 'var(--c-line)'}
          />
        </svg>
      ))}
    </span>
  );
}


