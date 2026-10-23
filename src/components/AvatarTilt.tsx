"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The avatar frame, leaning toward the cursor.
 *
 * Every other solid on this page lifts a fixed amount when you point at it.
 * This one doesn't, at Bradley's request: "instead of poking out on the hover
 * animation, just have it follow the cursor when it gets close to it, like it
 * pokes out to follow the cursor in a 3D way." So the frame starts reaching
 * before the pointer arrives, and the corner nearest the cursor is the one
 * that comes forward.
 *
 * ## Why this one gets a camera and nothing else does
 *
 * The rest of the page is drawn in oblique projection precisely so that a
 * face 10px proud of the page still projects at 1:1 — see the solid system in
 * globals.css, where the whole argument is. A rotation has no such property:
 * the moment this frame turns, its face is foreshortened. That's allowed here
 * and nowhere else for two reasons. It only happens while the pointer is
 * within reach, so the resting page — the thing that must not change — never
 * sees it. And what's inside is a photograph, not type: there's no glyph
 * being re-rasterised at a new subpixel offset, which is the cost that rules
 * perspective out everywhere else.
 *
 * `perspective()` is a function in the element's own transform rather than
 * the `perspective` property on a parent, so that at rest there is no 3D
 * context anywhere near the photo. At rest the inline transform is removed
 * outright, for the same reason nothing else on this page is transformed at
 * rest.
 *
 * ## It creeps over Exy's tail, by 5px
 *
 * The tail pokes out of `#exy-den` on the frame's left edge, and the frame
 * paints over the rest of it. Reaching for the tail now brings the frame
 * most of the way into its lean before the pointer gets there, and the lean
 * is up and to the *left* — so the strip of tail you can click goes from 31px
 * to 26px, measured by hit-testing every column of it with the frame at
 * k≈0.93.
 *
 * Left as it is, deliberately. The frame paints over the tail, so the strip
 * you can see and the strip you can click shrink together — there is no
 * invisible edge to miss, 26px is a wide target for a thing that is 86px
 * tall, and the alternative is a hole in the reach where the frame flinches
 * back as you approach it. If the tail ever starts to feel fiddly, the fix is
 * to fade `k` to 0 over the den's own band rather than to shorten `RISE`.
 *
 * ## How it degrades
 *
 * The `solid-track` class is added here, by this component, rather than
 * written into the class string in `ProfileHeader`. That's the whole
 * fallback: with no JS, on a touch screen, or under `prefers-reduced-motion`,
 * the class never lands and the frame keeps the ordinary hover lift that
 * every other solid has. React state rather than `classList.add`, because
 * `AutoRefresh` calls `router.refresh()` on a timer and a class added outside
 * React is one more thing to reason about when it does.
 */

/** How far outside the frame the pointer is still "close", in px. */
const REACH = 110;
/** Degrees at a full lean. Past ~10 the photo starts to read as a card. */
const TILT = 9;
/**
 * The lift at a full lean, in px.
 *
 * It's the lift this frame had as an ordinary solid — `.solid-deep`'s 10px
 * depth times the default `--lift-on` of 0.5 — so the thing it replaces
 * reaches the same height, and the walls below it are still scaled by the
 * same `--lift-on` the rest of the system uses.
 */
const RISE = 5;

/** 0 at the edge of reach, 1 against the frame, eased at both ends. */
function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export default function AvatarTilt({
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

    setTracking(true);

    let queued = 0;
    let px = -1e4;
    let py = -1e4;
    let resting = true;

    const draw = () => {
      queued = 0;

      /*
       * The frame's box *without* its own transform, which is what the
       * distance has to be measured against — `getBoundingClientRect()` here
       * returns the leaning box, so using it would feed the lean back into
       * the maths that produced it. `offsetLeft`/`offsetWidth` ignore
       * transforms, and the offset parent is the avatar block, which carries
       * neither border nor padding, so its own rect is the origin they're
       * relative to.
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
         * Drop every override together: the transform goes back to none and
         * the timing goes back to the solid system's own 260ms overshoot, so
         * the frame settles with the same bounce everything else lands with.
         */
        frame.style.removeProperty("transform");
        frame.style.removeProperty("transition-duration");
        frame.style.removeProperty("transition-timing-function");
        frame.style.setProperty("--track-k", "0");
        return;
      }

      /*
       * Direction, ±1 by a little outside the frame rather than at the edge
       * of reach — the lean should be most of the way over by the time the
       * pointer is on the photo, not still building.
       */
      const ux = clamp((px - (left + w / 2)) / (w / 2 + 60), -1, 1);
      const uy = clamp((py - (top + h / 2)) / (h / 2 + 60), -1, 1);

      if (resting) {
        resting = false;
        /*
         * Quick and flat while it's following. The bounce is for a box that
         * was let go of; a frame tracking the pointer wants to be under it,
         * and an overshoot on every mouse move reads as wobble.
         */
        frame.style.transitionDuration = "90ms";
        frame.style.transitionTimingFunction = "ease-out";
      }

      /*
       * Signs, from the CSS transform matrices rather than from trying it:
       * `rotateY(+θ)` sends the right-hand edge away from the viewer and
       * `rotateX(+θ)` brings the bottom edge toward it. So the corner nearest
       * the cursor is the one that comes forward — "poking out to follow it"
       * — at `rotateY(-ux)` and `rotateX(+uy)`.
       */
      frame.style.transform =
        `perspective(900px) translate(${(-RISE * k).toFixed(2)}px, ${(-RISE * k).toFixed(2)}px)` +
        ` rotateY(${(-TILT * k * ux).toFixed(2)}deg) rotateX(${(TILT * k * uy).toFixed(2)}deg)`;
      frame.style.setProperty("--track-k", k.toFixed(3));
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
      frame.style.removeProperty("transform");
      frame.style.removeProperty("transition-duration");
      frame.style.removeProperty("transition-timing-function");
      frame.style.removeProperty("--track-k");
    };
  }, []);

  return (
    <div ref={el} className={tracking ? `${className} solid-track` : className}>
      {children}
    </div>
  );
}
