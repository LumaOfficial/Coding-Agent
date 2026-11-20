import { useEffect, useState } from 'react';

const QUERY = '(min-width: 700px)';

/**
 * "Am I actually in a browser window?" Wide viewport → full app with docked
 * columns. Narrow viewport (extension side panel) → single column with
 * overlay drawers, the way the app was originally built.
 */
export default function useBrowserLayout() {
  const [full, setFull] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const query = window.matchMedia(QUERY);
    const onChange = (event) => setFull(event.matches);
    setFull(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return full;
}
