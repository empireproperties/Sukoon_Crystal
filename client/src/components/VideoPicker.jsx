import { useEffect, useRef, useState } from 'react';
import { Video, X, Loader2 } from 'lucide-react';

import { api } from '../lib/api.js';
import { useShop } from '../lib/store.jsx';

/* Mirrors the server's cap in server/index.js. Checked here as well so someone
   on a phone connection is told immediately, rather than after spending two
   minutes uploading something that will be rejected. */
export const MAX_VIDEO_MB = 100;
const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime,video/x-m4v';

/**
 * Records the clip attached to a review. Used by the customer's own review form
 * and by the admin's, which is why it lives here rather than inside either.
 *
 * The file is sent as soon as it is chosen rather than with the rest of the
 * form, for two reasons: a 100MB upload inside a form submit means a button that
 * looks frozen for a minute, and sending it early lets the person watch what
 * they attached before committing to it.
 *
 * `value` is the stored URL once the upload has finished. The form posts that
 * string and nothing else -- the server works out for itself where the file
 * lives, because a storage key supplied by a visitor is a request to delete
 * whatever it names.
 */
export default function VideoPicker({ value, onChange, disabled, admin = false, label }) {
  const { toast } = useShop();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  /* An object URL for the chosen file, so the preview plays from disk instead
     of pulling the clip back down over the same connection that just pushed it
     up. Revoked on replace and on unmount. */
  const [localPreview, setLocalPreview] = useState('');

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                     /* so re-picking the same file fires */
    if (!file) return;

    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast(`That clip is ${Math.round(file.size / 1024 / 1024)}MB. Please keep it under ${MAX_VIDEO_MB}MB.`, 'error');
      return;
    }

    const preview = URL.createObjectURL(file);
    setBusy(true);
    try {
      const { url } = await api.uploadReviewVideo(file, { admin });
      setLocalPreview((old) => { if (old) URL.revokeObjectURL(old); return preview; });
      onChange(url);
    } catch (err) {
      URL.revokeObjectURL(preview);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview('');
    onChange('');
  };

  if (value) {
    return (
      <div className="flex items-start gap-3 border border-line bg-surface p-3" style={{ borderRadius: 'var(--r-card)' }}>
        <video
          src={localPreview || value}
          muted
          playsInline
          controls
          preload="metadata"
          className="h-28 w-20 shrink-0 rounded bg-black object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[0.84rem] font-medium">Video attached</p>
          <p className="mt-0.5 text-[0.75rem] leading-snug text-muted">
            {admin
              ? 'It will publish with this review straight away.'
              : 'It will be published with your review once we have read it.'}
          </p>
          <button type="button" onClick={clear} className="btn btn-sm mt-2 border border-line">
            <X size={12} /> Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className="btn btn-outline btn-sm"
      >
        {busy
          ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
          : <><Video size={13} /> {label || 'Record or upload a clip'}</>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_VIDEO}
        /* On a phone this opens the camera directly. Desktop browsers ignore
           it and show the ordinary file picker. Not set for the admin, who is
           uploading a clip a customer already sent them. */
        {...(admin ? {} : { capture: 'environment' })}
        hidden
        onChange={pick}
      />
    </>
  );
}
