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
 * ## Touch, and why the whole thing is off on a phone
 *
 * There is no hover on a touch screen, so there a press-and-hold does it —
 * chosen over a tap so the mark stays a home link, which is what it is for.
 * `pointermove` cancels the hold, because a finger that has begun scrolling
 * isn't pressing anything, and the click that follows a completed hold is
 * suppressed or the browser would navigate home on top of the animation.
 *
 * None of it runs below `MIN_VW`. The thing being revealed slides into the
 * black surround, and on a phone the profile column fills the width — there is
 * no surround, so the fall would end in nothing. Under that width the mark
 * hops as it always did and stops there, which is also why three.js is never
 * fetched on a phone.
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

/**
 * Below this the gesture doesn't run at all.
 *
 * It has to match `MIN_VW` in `MarkReveal`, and the reason to keep them equal
 * is worth stating: below it there is no black column for the model to slide
 * into, so a fall would end in nothing. That is precisely the dead end fixed
 * by putting the reveal on every page — narrower than this, the honest thing
 * is for the mark to hop the way it always did and go no further.
 */
const MIN_VW = 1180;

/** How long a press has to be held on touch. */
const HOLD_MS = 500;

export default function NavMark() {
  const ref = useRef<HTMLAnchorElement>(null);
  /** Pending long-press timer, so it can be cancelled. */
  const hold = useRef<number | null>(null);

  const clearHold = () => {
    if (hold.current !== null) {
      window.clearTimeout(hold.current);
      hold.current = null;
    }
  };
  useEffect(() => clearHold, []);
  const [falling, setFalling] = useState(false);
  /*
   * Set once the glyphs are off the page. `falling` alone isn't enough: the
   * animation holds them below the clip with `forwards`, so the anchor is
   * still a full-size link over empty space — invisible, focusable, and
   * clickable. This turns it inert.
   */
  const [gone, setGone] = useState(false);

  /*
   * Reset when the sequence is dismissed, so the mark comes back. `MarkReveal`
   * owns the dismissal (Escape, or clicking the model) and says so here rather
   * than either component reaching into the other's state.
   */
  useEffect(() => {
    const back = () => {
      setFalling(false);
      setGone(false);
    };
    window.addEventListener("bt:reset", back);
    return () => window.removeEventListener("bt:reset", back);
  }, []);

  function fall() {
    if (falling) return;
    if (window.innerWidth < MIN_VW) return;

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
     * 1.37s is when the last glyph is away — the fall is 1.15s and the period
     * starts 220ms late. The link goes inert then, and the reveal follows
     * roughly half a second after that.
     */
    window.setTimeout(() => setGone(true), 1380);
    window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("bt:reveal")),
      1500,
    );
  }

  return (
    <span className="flex items-center self-stretch overflow-hidden">
      {/*
        Once the glyphs are gone this stops being a link: no `href`, out of the
        tab order, and inert to the pointer. It keeps its box so the nav items
        beside it don't shift — the space is still the mark's, there just isn't
        a mark in it. `MarkReveal` is the home link for as long as that holds.
      */}
      <a
        ref={ref}
        href={gone ? undefined : "/#top"}
        aria-label={gone ? undefined : `${profile.name} — home`}
        aria-hidden={gone || undefined}
        tabIndex={gone ? -1 : undefined}
        /*
          Hover fires it with a mouse; a press-and-hold fires it on touch,
          where there is no hover to use.
        */
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") fall();
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          hold.current = window.setTimeout(fall, HOLD_MS);
        }}
        /*
          Any of these ends the press. `pointermove` too: a finger that has
          started scrolling is not holding the mark, and without this the
          gesture fires halfway down the page.
        */
        onPointerUp={clearHold}
        onPointerCancel={clearHold}
        onPointerMove={clearHold}
        /*
          Suppress the tap that follows a hold. A long press still ends in a
          click, so without this the fall would fire and the browser would then
          navigate home on top of it.
        */
        onClick={(e) => {
          if (falling) e.preventDefault();
        }}
        className={`group/mark text-bright motion-reduce:transition-opacity motion-reduce:hover:opacity-80 ${
          gone ? "pointer-events-none" : ""
        }`}
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
