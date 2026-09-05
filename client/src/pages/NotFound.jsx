import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5 py-16 text-center">
      <div>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">This page could not be found</h1>
        <p className="mx-auto mt-4 max-w-sm text-[0.92rem] leading-relaxed text-muted">
          The link may be out of date, or the product may have moved. The shop is still where you left it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn btn-primary"><ArrowLeft size={14} /> Back to home</Link>
          <Link to="/shop" className="btn btn-outline"><Search size={14} /> Browse all crystals</Link>
        </div>
      </div>
    </div>
  );
}
