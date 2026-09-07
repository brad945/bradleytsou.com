"use client";

import { useEffect, useRef, useState } from "react";
import BtMark from "@/components/BtMark";
import { profile } from "@/lib/profile-data";

/**
 * The nav's `bt.` mark, which hops on hover and — once — falls off the page.
 *
 * ## The gesture
 *
 * Hovering runs `glyph-fall`: the same rise `glyph-hop` always did, followed
 * by a drop that doesn't come back. The glyphs fall out of the nav, vanish at
 * its bottom edge, and `MarkReveal` slides the 3D mark out of the left column
 * once it has loaded.
 *
 * ## Where they disappear
 *
 * At the header bar's own edge, because the wrapper below stretches to the
 * bar's full height and clips.
 *
 * The first version let them fall past it and be covered by `<main>` instead,
 * which is the same idea one element too late: `<main>` is a *centred* column,
 * so it covers only the middle of the page, and the edge a reader actually
 * sees is the bar's. Clipping on `<nav>` itself was the obvious next move and
 * is wrong for a different reason — the balance's hover note is `absolute
 * top-full` and hangs below the bar, so a clip there would cut it off. Hence a
 * wrapper around the mark alone.
 *
 * `self-stretch` rather than a height: the bar's 104px lives in `SiteNav`, and
 * repeating it here is a second place to update. Stretching to the flex line
 * gets the same box and can't drift. The rise is safe either way — 34px of
 * clearance above the mark against 11px of travel.
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

  /*
   * Reset when the sequence is dismissed, so the mark comes back. `MarkReveal`
   * owns the dismissal (Escape, or clicking the model) and says so here rather
   * than either component reaching into the other's state.
   */
  useEffect(() => {
    const back = () => setFalling(false);
    window.addEventListener("bt:reset", back);
    return () => window.removeEventListener("bt:reset", back);
  }, []);

  function onEnter() {
    if (falling) return;

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
    <span className="flex items-center self-stretch overflow-hidden">
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
    </span>
  );
}
