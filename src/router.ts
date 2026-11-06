import { useEffect, useState } from 'react';
import { pathFromHash } from './routes';

export function useHashPath(): string {
  const [path, setPath] = useState(() => pathFromHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setPath(pathFromHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export const href = (path: string): string => '#' + path;

export function navigate(path: string): void {
  window.location.hash = href(path);
}
