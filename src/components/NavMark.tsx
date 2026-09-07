"use client";

import { useEffect, useRef, useState } from "react";
import BtMark from "@/components/BtMark";
import { profile } from "@/lib/profile-data";

/**
 * The nav's `bt.` mark, which hops on hover and — once — falls off the page.
 *
 * ## The gesture
 *
 * Hovering still plays `glyph-hop`, unchanged: b, then t, then the period,
 * 110ms apart, once per hover. Hovering it *again* while the page is at the
 * top runs `glyph-fall` instead, which is the same rise followed by a drop
 * that doesn't come back — the glyphs fall out of the nav, behind the profile
 * block, and `MarkReveal` slides the 3D mark out of the left column half a
 * second later.
 *
 * The second hover is deliberate. A page-wide animation that fires the first
 * time a pointer crosses the top-left corner would go off constantly and by
 * accident; asking for the gesture twice makes it something you did.
 *
 * ## Why the glyphs land behind the profile block for free
 *
 * Nothing here manages z-index, and nothing should. `<nav>` comes before
 * `<main>` in the document and neither sets a `z-index`, so `<main>` paints
 * later and therefore on top. A glyph leaving the nav is behind the profile
 * column the moment it crosses that edge, which is exactly the effect wanted —
 * an overlay with a stacking context, or a clipping wrapper, would both have
 * been ways of re-creating something the document already does.
 *
 * The one requirement is that no ancestor clips: the svg carries
 * `overflow-visible` (it already had to, for the hop's rise), and the nav sets
 * no overflow of its own.
 *
 * ## The unit trap
 *
 * `--fall` is a **viewBox** distance. Transforms on an SVG child are in the
 * units of its viewBox — the mark's is 408x292 rendered at 50x36, so one
 * screen pixel is 292/36 ≈ 8.1 units. Measuring the drop in pixels and
 * feeding it straight to `translateY` would fall an eighth of the way and stop
 * inside the nav.
 */

/** viewBox units per screen pixel, vertically. See the note above. */
const UNITS_PER_PX = 292 / 36;

export default function NavMark() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [falling, setFalling] = useState(false);
  const [armed, setArmed] = useState(false);

  /*
   * Reset when the sequence is dismissed, so the mark comes back. `MarkReveal`
   * owns the dismissal (Escape, or clicking the model) and says so here rather
   * than either component reaching into the other's state.
   */
  useEffect(() => {
    const back = () => {
      setFalling(false);
      setArmed(false);
    };
    window.addEventListener("bt:reset", back);
    return () => window.removeEventListener("bt:reset", back);
  }, []);

  function onEnter() {
    if (falling) return;
    if (!armed) {
      setArmed(true);
      return;
    }

    /*
     * How far to fall: from the mark's own top edge to the top of the profile
     * block, plus its height so the last glyph is fully past the edge rather
     * than half-clipped by it.
     *
     * Measured at trigger time rather than hardcoded, because it depends on
     * scroll position and on the nav wrapping at narrow widths — both of which
     * a constant would get wrong.
     */
    const mark = ref.current?.getBoundingClientRect();
    const main = document.querySelector("main")?.getBoundingClientRect();
    if (!mark || !main) return;

    const px = Math.max(0, main.top - mark.top) + mark.height + 24;
    ref.current?.style.setProperty(
      "--fall",
      `${Math.round(px * UNITS_PER_PX)}px`,
    );

    setFalling(true);
    /*
     * Half a second after the last glyph is away — the fall is 1.15s and the
     * period starts 220ms late, so the mark is fully gone at ~1.37s.
     */
    window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("bt:reveal")),
      1500,
    );
  }

  return (
    <a
      ref={ref}
      href="/#top"
      aria-label={`${profile.name} — home`}
      onPointerEnter={onEnter}
      className="group/mark text-bright motion-reduce:transition-opacity motion-reduce:hover:opacity-80"
    >
      {/*
        `overflow-visible` is not optional, and now for two reasons. The
        viewBox is the mark's exact ink bounds, so the svg's default
        `overflow: hidden` would shear the top off every hop — and it would
        clip the entire fall to 36px of travel.
      */}
      <BtMark
        width={50}
        height={36}
        className="block overflow-visible"
        glyphClassName={
          falling
            ? {
                b: "motion-safe:animate-glyph-fall",
                t: "motion-safe:animate-glyph-fall-2",
                dot: "motion-safe:animate-glyph-fall-3",
              }
            : {
                b: "motion-safe:group-hover/mark:animate-glyph-hop",
                t: "motion-safe:group-hover/mark:animate-glyph-hop-2",
                dot: "motion-safe:group-hover/mark:animate-glyph-hop-3",
              }
        }
      />
    </a>
  );
}
