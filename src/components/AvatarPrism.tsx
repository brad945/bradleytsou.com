"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The avatar frame as a prism whose far end follows the cursor.
 *
 * Every other solid on this page lifts a fixed amount when you point at it.
 * This one doesn't, at Bradley's request — and the request came in two parts,
 * both of which matter. First: "instead of poking out on the hover animation,
 * just have it follow the cursor when it gets close to it." Then, on seeing a
 * version that moved the whole frame: "not the entire pfp element moving
 * around… imagine it's a rectangular prism that is transforming. not moving
 * position, the base stays the same, and the opposite face is moving around
 * and so the edges are what's moving/changing."
 *
 * So **the photograph does not move.** It is nailed to the page exactly where
 * it sits at rest, and the block underneath it deforms: the far end of the
 * prism swings around and the two visible walls reshape to reach it. The only
 * thing this component writes is a depth vector.
 *
 * ## Why that's better than the version it replaces, not just different
 *
 * The first one translated the frame and rotated it under a `perspective()`.
 * That moved the photo, foreshortened it, and made this the one place on the
 * site with a camera in it — a documented exception to the projection
 * argument the whole solid system rests on. This version has no camera, no
 * rotation and no translation. The face projects 1:1 because nothing touches
 * it, and the walls are the same two parallelograms the rest of the page
 * draws, with a depth vector that isn't 45°. It stopped being an exception
 * and became an instance.
 *
 * It also ends the one real cost the old version had: the frame crept up to
 * 5px left over Exy's tail as you reached for it, taking the clickable strip
 * from 31px to 26px. A frame that never moves can't cover anything.
 *
 * ## The vector, and why it's polar
 *
 * `--ux` / `--uy` are the depth vector in units of `--depth`, and both have
 * to stay positive: the right wall starts at the face's right edge and the
 * underside at its bottom edge, so a negative component folds a wall back
 * over the face it grew from. Driving x and y separately makes that a
 * constraint to remember. Driving an angle and a length makes it impossible —
 * the angle is clamped inside the quadrant and the length is never negative,
 * so nothing downstream can produce a folded wall.
 *
 * - **Angle.** 45° at rest, swung up to `SWING` toward the cursor along the
 *   anti-diagonal. Cursor up and to the right and the block points right;
 *   down and to the left and it points down. That axis is the one that's
 *   free: the other one is the depth axis itself, and leaning along *that*
 *   just makes the prism longer, which is what proximity already does.
 * - **Length.** `√2` at rest — the diagonal of a `--depth` square, which is
 *   what a 45° wall vector actually measures — growing by `GROW` as the
 *   pointer closes. At full reach that's the 1.5x the ordinary hover lift
 *   scales the walls to, so the frame reaches about as far out of the page
 *   as it used to and only the direction is new.
 */

/** How far outside the frame the pointer is still "close", in px. */
const REACH = 110;
/**
 * Degrees the depth axis swings off 45.
 *
 * With `GROW` below, this sets how far the right wall can reach: at full
 * swing it's `√2 · (1 + GROW) · cos(45° − SWING)` deep, which is 1.76 x the
 * resting depth, or ~18px on this frame. The gap to the bio text beside it
 * is 20px and the walls are opaque steel, so the ceiling is a measurement
 * rather than a preference — raise either and the wall paints over the text.
 */
const SWING = 22;
/** How much longer the prism gets at full reach. */
const GROW = 0.35;

/** 0 at the edge of reach, 1 against the frame, eased at both ends. */
function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export default function AvatarPrism({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    const frame = el.current;
    if (!frame) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /*
     * The class is added here rather than written into the class string in
     * `ProfileHeader`, and that is the whole fallback: with no JS, on a touch
     * screen or under `prefers-reduced-motion` it never lands, so the frame
     * keeps the ordinary hover lift that every other solid has. React state
     * rather than `classList.add`, because `AutoRefresh` calls
     * `router.refresh()` on a timer and a class added outside React is one
     * more thing to reason about when it does.
     */
    setTracking(true);

    let queued = 0;
    let px = -1e4;
    let py = -1e4;
    let resting = true;

    const draw = () => {
      queued = 0;

      /*
       * `offsetLeft`/`offsetWidth`, not `getBoundingClientRect`, for the same
       * reason as before: the rect would include the walls' own effect on the
       * element's ink, and the offset parent is the avatar block, which
       * carries neither border nor padding. The face never transforms now, so
       * this is the box the pointer is actually being measured against.
       */
      const parent = frame.offsetParent as HTMLElement | null;
      if (!parent) return;
      const origin = parent.getBoundingClientRect();
      const left = origin.left + frame.offsetLeft;
      const top = origin.top + frame.offsetTop;
      const w = frame.offsetWidth;
      const h = frame.offsetHeight;

      /* Distance from the box itself, so anywhere on the frame is zero. */
      const gapX = Math.max(left - px, 0, px - (left + w));
      const gapY = Math.max(top - py, 0, py - (top + h));
      const away = Math.hypot(gapX, gapY);
      const k = away >= REACH ? 0 : smoothstep(1 - away / REACH);

      if (k === 0) {
        if (resting) return;
        resting = true;
        /*
         * Back to a 45° axis of exactly the resting depth, and back to the
         * solid system's own 260ms overshoot — so the prism settles with the
         * same bounce every other box on the page lands with.
         */
        frame.style.removeProperty("--ux");
        frame.style.removeProperty("--uy");
        frame.style.removeProperty("--solid-ms");
        frame.style.removeProperty("--solid-ease");
        return;
      }

      /*
       * Where the pointer sits along the anti-diagonal: positive up and to
       * the right, negative down and to the left. Measured from the frame's
       * centre and normalised over roughly its own half-size, so the swing is
       * most of the way over by the time the pointer is on the photo rather
       * than still building at the edge of reach.
       */
      const span = (w + h) / 4 + 60;
      const s = clamp(
        (px - (left + w / 2) - (py - (top + h / 2))) / span,
        -1,
        1,
      );

      const angle = ((45 - s * k * SWING) * Math.PI) / 180;
      /* √2 is the resting vector's length: the diagonal of a --depth square. */
      const reach = Math.SQRT2 * (1 + GROW * k);

      if (resting) {
        resting = false;
        /*
         * Quick and flat while it's following. The bounce is for a box that
         * was let go of; a prism tracking the pointer wants to be under it,
         * and an overshoot on every mouse move reads as wobble.
         *
         * **The custom properties, not `transition-duration` itself.** All
         * the motion here is in the walls, and the walls are
         * pseudo-elements: their transition comes from `var(--solid-ms)` /
         * `var(--solid-ease)` in the `::before, ::after` rule. Custom
         * properties inherit and `transition-duration` does not, so setting
         * the longhand on the element reaches the face — which never
         * transitions anything — and leaves the walls on the solid system's
         * 260ms overshoot. Measured before the fix: the element read 0.09s
         * while `::before` read 0.26s on `cubic-bezier(0.34, 1.7, 0.5, 1)`,
         * and a wall swinging 0.746 → 1.757 passed through 1.827, which is
         * 18.3px against the 20px of clearance this has.
         */
        frame.style.setProperty("--solid-ms", "90ms");
        frame.style.setProperty("--solid-ease", "ease-out");
      }

      frame.style.setProperty("--ux", (reach * Math.cos(angle)).toFixed(4));
      frame.style.setProperty("--uy", (reach * Math.sin(angle)).toFixed(4));
    };

    const onMove = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (!queued) queued = requestAnimationFrame(draw);
    };

    /* Scrolling moves the frame under a pointer that hasn't moved at all. */
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(draw);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (queued) cancelAnimationFrame(queued);
      frame.style.removeProperty("--ux");
      frame.style.removeProperty("--uy");
      frame.style.removeProperty("--solid-ms");
      frame.style.removeProperty("--solid-ease");
    };
  }, []);

  return (
    <div ref={el} className={tracking ? `${className} solid-track` : className}>
      {children}
    </div>
  );
}
