import { useEffect, useState } from 'react';
import { ANNOUNCE_EVENT } from './announce';

export function LiveRegion() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const onAnnounce = (e: Event) => setMessage((e as CustomEvent<string>).detail);
    window.addEventListener(ANNOUNCE_EVENT, onAnnounce);
    return () => window.removeEventListener(ANNOUNCE_EVENT, onAnnounce);
  }, []);
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true" role="status">
      {message}
    </div>
  );
}
