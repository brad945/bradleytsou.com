"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The avatar frame as a prism pinned to the page by its back face.
 *
 * Every other solid on this page lifts a fixed amount when you point at it.
 * This one doesn't, at Bradley's request — and the request took three
 * messages to settle, all three of which are the design:
 *
 *   "instead of poking out on the hover animation, just have it follow the
 *   cursor when it gets close to it."
 *
 *   "not the entire pfp element moving around… imagine it's a rectangular
 *   prism that is transforming. not moving position, the base stays the same,
 *   and the opposite face is moving around and so the edges are what's
 *   moving/changing."
 *
 *   "the pfp is supposed to be the part that moves and the 'base' face is the
 *   proverbial part that's attached to the website."
 *
 * So: **the back face is glued to the page and the photograph is the end that
 * sticks out and moves.** The back face is the one you never see, down-right
 * of the photo at `--depth` along the axis; it never moves. The photo shifts
 * toward a nearby pointer, and the two walls are the lateral faces joining
 * the two, so what visibly changes are the edges.
 *
 * The first attempt moved the whole object — a translate plus a rotation
 * under a `perspective()` — which is what the second message rejected. The
 * second pinned the *photo* and swung the back face, which is the same shear
 * with the two faces swapped, and is what the third message rejected. This
 * one has them the right way round.
 *
 * There is still no camera in it: a translate on the face and two sheared
 * quads, no rotation and no perspective. The photo is never foreshortened, so
 * this stays an instance of the projection argument the solid system rests on
 * rather than an exception to it.
 *
 * ## What it writes, and why nothing can fold
 *
 * `--ux` / `--uy` are the offset from the moved face to the pinned base, in
 * units of `--depth`; `--sa` / `--fa` are the angles the walls shear at; and
 * the face's own translate is derived from `--ux` / `--uy` rather than being
 * a second opinion about the same geometry — it is exactly
 * `(1 - u) · depth`, which is what keeps the base still. See `.solid-track`
 * in globals.css for the two wall transforms.
 *
 * Both scale factors have to stay positive: the right wall starts at the
 * face's right edge and the underside at its bottom edge, so a negative one
 * folds a wall back over the face it grew from. `RISE` and `TRAVEL` below are
 * fractions of the depth, bounded so that can't happen — `u` runs 0.75 to
 * 1.75 and never approaches zero.
 *
 * ## No transition while it's following
 *
 * `--solid-ms` goes to `0ms` while tracking, so the prism is redrawn against
 * the pointer each frame rather than easing toward it. Two reasons, and the
 * second is the one that bit: a 90ms ease re-targeted on every `pointermove`
 * lags the cursor for no benefit, and interpolating transforms at all is what
 * made the first version glitch — see the note in globals.css on why the
 * walls are a skew and a scale rather than one `matrix()`. Letting go
 * restores the 260ms overshoot, so the settle still bounces like every other
 * box.
 */

/** How far outside the frame the pointer is still "close", in px. */
const REACH = 110;
/**
 * How much further out of the page the photo sits at full reach, as a
 * fraction of `--depth`. 0.25 x 10px = 2.5px, along the depth axis.
 */
const RISE = 0.25;
/**
 * How far the photo shifts toward the pointer, as a fraction of `--depth`.
 *
 * With `RISE` this sets both of the bounds that matter. The walls reach
 * `(1 + RISE + TRAVEL) x depth` = 1.75x, or 17.5px on this frame, against
 * 20px of gap to the bio text beside it — with opaque steel walls, so that
 * ceiling is a measurement rather than a preference. And the photo travels up
 * to 7.5px toward the top-left, which is how much of Exy's tail it can cover.
 * Raise either number and check both.
 */
const TRAVEL = 0.5;

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
        frame.style.removeProperty("--sa");
        frame.style.removeProperty("--fa");
        frame.style.removeProperty("transform");
        frame.style.removeProperty("--solid-ms");
        return;
      }

      /*
       * Direction to the pointer, each axis +/-1 by a little outside the
       * frame rather than at the edge of reach — the photo should be most of
       * the way over by the time the pointer is on it, not still building.
       */
      const dirX = clamp((px - (left + w / 2)) / (w / 2 + 60), -1, 1);
      const dirY = clamp((py - (top + h / 2)) / (h / 2 + 60), -1, 1);

      /*
       * The offset from the face to the pinned base, in units of depth. The
       * photo moving *toward* the pointer shortens the wall on that side,
       * which is what a prism leaning that way does: its lateral face turns
       * edge-on to you.
       */
      const ux = 1 + k * (RISE - TRAVEL * dirX);
      const uy = 1 + k * (RISE - TRAVEL * dirY);

      if (resting) {
        resting = false;
        /*
         * No easing at all while it's following — see the note at the top of
         * this file. **`--solid-ms`, not `transition-duration`:** the motion
         * is in the walls, the walls are pseudo-elements, and their
         * transition reads `var(--solid-ms)` from the `::before, ::after`
         * rule. Custom properties inherit and `transition-duration` does
         * not, so the longhand reaches the face and leaves the walls easing
         * on their own.
         */
        frame.style.setProperty("--solid-ms", "0ms");
      }

      frame.style.setProperty("--ux", ux.toFixed(4));
      frame.style.setProperty("--uy", uy.toFixed(4));
      /* Each wall shears along the same face-to-base axis. */
      frame.style.setProperty(
        "--sa",
        `${((Math.atan2(uy, ux) * 180) / Math.PI).toFixed(3)}deg`,
      );
      frame.style.setProperty(
        "--fa",
        `${((Math.atan2(ux, uy) * 180) / Math.PI).toFixed(3)}deg`,
      );
      /*
       * And the face. Derived from the same two numbers rather than computed
       * separately, because `(1 - u) · depth` *is* the offset that leaves
       * the base where it is — two independent expressions of that could
       * drift apart and un-pin it.
       */
      frame.style.transform =
        "translate(calc((1 - var(--ux)) * var(--depth))," +
        " calc((1 - var(--uy)) * var(--depth)))";
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
      frame.style.removeProperty("--sa");
      frame.style.removeProperty("--fa");
      frame.style.removeProperty("transform");
      frame.style.removeProperty("--solid-ms");
    };
  }, []);

  return (
    <div ref={el} className={tracking ? `${className} solid-track` : className}>
      {children}
    </div>
  );
}
