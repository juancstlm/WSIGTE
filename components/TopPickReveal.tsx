import { useEffect, useState } from "react";
import { motion } from "motion/react";

// Total time the fanfare owns the screen before it clears and reveals the gold
// card underneath. Kept short so it celebrates without getting in the way.
const FULL_MS = 1500;
const REDUCED_MS = 600;

interface TopPickRevealProps {
  /** Called once the interstitial has finished and should be unmounted. */
  onDone: () => void;
}

// A one-shot celebratory interstitial that plays the moment a Top Pick surfaces
// in the swipe deck. It renders over the (already gold-themed) card; when it
// clears, the card with its shimmer border is revealed underneath. Decorative —
// the card itself carries the real "★ Top Pick" content for screen readers.
export function TopPickReveal({ onDone }: TopPickRevealProps) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setReduced(reduce);
    const id = window.setTimeout(onDone, reduce ? REDUCED_MS : FULL_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);

  if (reduced) {
    // No scale/burst — just a brief gold fade so the moment still registers.
    return (
      <motion.div
        className="top-pick-reveal"
        role="status"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: REDUCED_MS / 1000, times: [0, 0.2, 0.7, 1] }}
      >
        <div className="top-pick-reveal-mark">
          <span className="top-pick-reveal-star" aria-hidden>
            ✦
          </span>
          <span className="top-pick-reveal-word">Top Pick</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="top-pick-reveal"
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{
        duration: FULL_MS / 1000,
        times: [0, 0.14, 0.72, 1],
        ease: "easeInOut",
      }}
    >
      <motion.div
        className="top-pick-reveal-burst"
        aria-hidden
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.25, 1.7], opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.1, times: [0, 0.4, 1], ease: "easeOut" }}
      />
      <motion.div
        className="top-pick-reveal-mark"
        initial={{ scale: 0.4, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.08 }}
      >
        <motion.span
          className="top-pick-reveal-star"
          aria-hidden
          initial={{ rotate: -25, scale: 0.5 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.12 }}
        >
          ✦
        </motion.span>
        <span className="top-pick-reveal-word">Top Pick</span>
      </motion.div>
    </motion.div>
  );
}
