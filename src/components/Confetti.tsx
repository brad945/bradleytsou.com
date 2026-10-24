"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

/**
 * One burst of confetti, thrown from a point on the page.
 *
 * Built the same way the reaction emoji are — DOM nodes carrying per-element
 * custom properties, animated by one keyframe in the Tailwind config — rather
 * than as a canvas with a `requestAnimationFrame` loop. Sixty composited
 * transforms cost less than sixty repaints of a canvas, nothing has to be
 * cleaned up if a render is interrupted, and it keeps the motion where the
 * rest of this site's motion lives, which is CSS.
 *
 * ## It has to be portalled, and that is not a style choice
 *
 * The burst fires while the pointer is still on the Tech Stack panel, so that
 * panel is lifted and carrying a transform. **A transformed ancestor becomes
 * the containing block for `position: fixed` descendants and a stacking
 * context besides**, so an overlay rendered in place would be sized to the
 * panel and painted under the next one — the full-screen burst would be a
 * burst inside a sidebar card. `createPortal` to `document.body` puts it back
 * where `fixed` means the viewport. (Exy is portalled for a related reason.)
 *
 * Colours are Tailwind classes from the token file rather than hex here, and
 * they are written out in full, because the scanner reads source as text and
 * cannot see a name assembled at runtime.
 */

/** Enough to read as an explosion; past ~80 they stop resolving as pieces. */
const PIECES = 60;

const COLOURS = ["bg-accent", "bg-link", "bg-live", "bg-bright"];

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(xs: readonly T[]) =>
  xs[Math.floor(Math.random() * xs.length)];

/** The longest a piece can be in flight, plus its delay. Drives the cleanup. */
const LIFETIME_MS = 2100;

interface Piece {
  colour: string;
  style: CSSProperties;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, () => {
    /*
     * Width and height separately, so the burst is a mix of long strips and
     * near-squares. One size makes it read as a particle system.
     */
    const w = rand(4, 9);
    const h = rand(7, 14);
    return {
      colour: pick(COLOURS),
      style: {
        width: `${w.toFixed(1)}px`,
        height: `${h.toFixed(1)}px`,
        /* A few are round, which is what sells the rest as paper. */
        borderRadius: Math.random() < 0.25 ? "9999px" : "1px",
        "--dx": `${rand(-300, 300).toFixed(0)}px`,
        "--peak": `${rand(-120, -290).toFixed(0)}px`,
        "--dy": `${rand(150, 430).toFixed(0)}px`,
        "--spin": `${rand(-720, 720).toFixed(0)}deg`,
        "--dur": `${rand(1.1, 1.9).toFixed(2)}s`,
        /* Staggered, or sixty pieces leave as one rigid shell. */
        animationDelay: `${rand(0, 140).toFixed(0)}ms`,
      } as CSSProperties,
    };
  });
}

export default function Confetti({
  x,
  y,
  onDone,
}: {
  /** Viewport coordinates of the origin. */
  x: number;
  y: number;
  onDone: () => void;
}) {
  /*
   * Generated once, in the initialiser rather than in an effect: a re-render
   * mid-flight must not reshuffle sixty trajectories, which would restart
   * every animation from the new values.
   */
  const [pieces] = useState(makePieces);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.body);
    const t = window.setTimeout(onDone, LIFETIME_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (!host) return null;

  return createPortal(
    /* `overflow-hidden` so a piece thrown sideways can't widen the document. */
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((piece, i) => (
        <span
          key={i}
          className={`absolute block animate-confetti will-change-transform ${piece.colour}`}
          style={{ left: `${x}px`, top: `${y}px`, ...piece.style }}
        />
      ))}
    </div>,
    host,
  );
}
