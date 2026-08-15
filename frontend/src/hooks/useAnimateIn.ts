import { useEffect, useState } from "react";

/**
 * Returns false for the first painted frame after `enabled` turns true, then true.
 *
 * Lets a CSS transition actually run: render the element at its "from" value
 * first, then flip to the target on the next frame so the browser has two
 * distinct values to interpolate between.
 *
 * Pass `enabled` so the flip happens when the *data* lands rather than when the
 * component mounts — pages that render a loading state first would otherwise
 * burn the animation frame before there is anything to animate.
 */
export function useAnimateIn(enabled = true): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [enabled]);

  return ready;
}
