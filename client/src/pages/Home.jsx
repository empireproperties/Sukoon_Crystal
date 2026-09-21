import { useMemo } from 'react';
import { api } from '../lib/api.js';
import { useAsync, useShop } from '../lib/store.jsx';

import HeroCarousel from '../components/HeroCarousel.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import OfferBanner from '../components/OfferBanner.jsx';
import ReviewsRail from '../components/ReviewsRail.jsx';
import OurStory from '../components/OurStory.jsx';
import TrustCards from '../components/TrustCards.jsx';
import ProductRail from '../components/ProductRail.jsx';

/* The homepage order was set by the owner:
     carousel → offer banner → shop by category → bestsellers
     → reviews → our story → trust → footer
   Each section degrades on its own: no slides falls back to a static hero, no
   live campaign falls back to a promise strip, no approved reviews falls back
   to an example layout. The page is never half-empty. */
export default function Home() {
  const { settings } = useShop();

  /* No sort asked for, which is the shop's own order: whatever has been
     arranged in Admin > Products first, then by what sells. */
  const popular = useAsync(() => api.products(), []);
  const categories = useAsync(() => api.categories(), []);
  const slides = useAsync(() => api.slides(), []);
  const reviews = useAsync(() => api.reviews({ limit: 12 }), []);

  /* The first twelve in the shop's own order, exactly as arranged in
     Admin > Products.
     This used to cap each collection at three, to stop one range filling
     the row. That guard second-guesses a decision the shop can now make
     for itself -- and it silently dropped whatever had been put fourth. */
  const edit = useMemo(() => (popular.data || []).slice(0, 12), [popular.data]);

  return (
    <>
      <HeroCarousel slides={slides.data || []} loading={slides.loading} />

      <OfferBanner />

      <CategoryGrid categories={categories.data || []} products={popular.data || []} />

      <ProductRail
        eyebrow="Most loved"
        title="Bestsellers"
        products={edit}
        loading={popular.loading}
        viewAllHref="/shop"
      />

      <ReviewsRail reviews={reviews.data || []} />

      <OurStory settings={settings} />

      <TrustCards />
    </>
  );
}
