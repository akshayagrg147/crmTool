import { useEffect, useRef, useState } from "react";

const NUM_PATTERN = /^([^\d-]*)(-?[\d,.]+)(.*)$/;

/** "₹1,240" -> "₹0", "12.5%" -> "0.0%". Used as the starting frame. */
function zeroForm(value: string): string {
  const match = value.match(NUM_PATTERN);
  if (!match) return value;
  const [, prefix, numStr, suffix] = match;
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  return `${prefix}${(0).toFixed(decimals)}${suffix}`;
}

/** Animates from 0 to a target number extracted from a formatted string, preserving prefix/suffix. */
export function useCountUp(value: string, durationMs = 900): string {
  // Start at zero so the first painted frame is the start of the count,
  // not a flash of the final figure.
  const [display, setDisplay] = useState(() => zeroForm(value));
  const frameRef = useRef<number>();

  // No "did the value change?" ref-guard here on purpose: the dependency array
  // already restricts this to real value changes, and a ref guard would survive
  // StrictMode's mount/unmount/remount cycle — the second mount would bail out
  // early and leave the number frozen at its starting frame.
  useEffect(() => {
    const match = value.match(NUM_PATTERN);
    if (!match) {
      setDisplay(value);
      return;
    }
    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr.replace(/,/g, ""));
    if (Number.isNaN(target)) {
      setDisplay(value);
      return;
    }
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;

    // Seed the clock from the first rAF callback rather than performance.now().
    // The two are not guaranteed to share a time origin — in embedded webviews
    // they can be seconds apart — and mixing them makes `elapsed` huge on the
    // very first frame, so the animation reports itself finished and snaps
    // straight to the final value.
    let start: number | undefined;

    function tick(now: number) {
      if (start === undefined) start = now;
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      setDisplay(`${prefix}${current.toFixed(decimals)}${suffix}`);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return display;
}
