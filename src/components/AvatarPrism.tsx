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
 * And a fourth, which is the gate rather than the geometry:
 *
 *   "change the pfp following cursor when near to only after it hovers over
 *   the pfp, then have it do the following animation."
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
 * fractions of the depth, bounded so that can't happen — `u` runs 0.25 to
 * 2.25 and never reaches zero.
 *
 * ## It waits to be pointed at
 *
 * **Nothing moves until the pointer has been on the photo**, which is the
 * fourth message above. It used to start leaning at 110px, and that made it
 * the one thing on this page that reacted to a pointer it wasn't under — the
 * carve-out CLAUDE.md had to write for it specially. Now `REACH` is the
 * distance at which it *lets go* rather than the distance at which it starts:
 * hover the photo once and it follows the cursor out to 110px, and past that
 * it settles back and needs another hover.
 *
 * **Arming has to ease in.** `k` is 1 the instant the pointer is on the box,
 * so without a ramp the photo lands on ~9px of travel in the single frame the
 * pointer crosses an edge — and `--solid-ms` is 0ms while it tracks, so there
 * is no transition to round that off. Which is exactly the single-frame jump
 * he called "extremely glitchy" the first time round. `ENTER_MS` is the
 * ease-in, run in JS because that is where the rest of the tracking is;
 * measured, it turns an 8.4px step into no more than 1.4px in any one frame.
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

/**
 * How far outside the frame the pointer can get before it lets go, in px.
 *
 * It is the *release* distance, not the trigger: nothing starts until the
 * pointer has been on the photo. See the gate above.
 */
const REACH = 110;
/**
 * How long the photo takes to reach full travel once the pointer lands on it.
 *
 * Short enough to read as the photo answering the cursor rather than as an
 * animation playing, long enough that no frame moves it more than a pixel or
 * so — which is the whole reason it exists.
 */
const ENTER_MS = 160;
/**
 * How much further out of the page the photo sits at full reach, as a
 * fraction of `--depth`. 0.25 x 10px = 2.5px, along the depth axis.
 */
const RISE = 0.25;
/**
 * How far the photo shifts toward the pointer, as a fraction of `--depth`.
 *
 * Raised twice, both times by Bradley — 0.5 to 0.7 for "a bit more", then 0.7
 * to 1 by name: "change .7 TO 1 for the 'following scale' multiplyer".
 *
 * Two things bound it, and only one of them is what you'd expect:
 *
 * - **Neither number can reach the bio text beside the frame**, and that
 *   isn't a coincidence to be re-checked — it's the pinned base. The right
 *   wall runs from the face's right edge to the base's right edge, and the
 *   face moves by exactly `(1 - u) · depth`, so the wall's outer edge lands
 *   on `frame_right + depth` for *every* value of `u`. Measured by sweeping
 *   the pointer right round the frame: the furthest it ever reaches is
 *   x=400.0, every time, against text at x=410. An earlier version of this
 *   comment claimed the sum of these two was capped at 1.9 by that 20px gap.
 *   It isn't; the gap is a constant 10px and the ceiling was imaginary.
 * - **The photo travels `(RISE + TRAVEL) x depth` toward the top-left**,
 *   12.5px at 1, and that is how much of Exy's tail it covers on the way
 *   past. This is the real cost, and the one to re-measure on every change to
 *   either knob: 22 columns of the 31 the strip has at rest, down from 24 at
 *   0.7. It is a **worst case** now rather than the standing cost, and the
 *   gate is why — the photo doesn't lean until it has been pointed at, so
 *   someone reaching straight for the tail from outside the frame still has
 *   all 31. 22 is what's left with the pointer already on the photo and
 *   dragged toward the tail, which is also how it was measured.
 *
 * The hard ceiling is `1 + RISE - TRAVEL > 0`, i.e. 1.25, since a negative
 * scale folds a wall back over its own face. At 1 the shallow wall is already
 * down to 0.25 x depth — 2.5px — so most of what was left is spent, and this
 * is not a knob with much more in it.
 */
const TRAVEL = 1;

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
    /* Whether the pointer has been on the photo yet — see the gate above. */
    let armed = false;
    let armedAt = 0;

    const letGo = () => {
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
    };

    const draw = (now: number) => {
      queued = 0;

      /*
       * `offsetLeft`/`offsetWidth`, not `getBoundingClientRect`, and now it's
       * load-bearing rather than tidiness: **the face transforms, and the
       * rect would be the transformed one.** Measuring the pointer against a
       * box that moves *because* of the measurement is a feedback loop — the
       * photo leans toward the pointer, which shortens the gap, which leans
       * it further. The offset box is the resting geometry and never moves.
       * (The offset parent is the avatar block, which carries neither border
       * nor padding, so no correction is needed on top.)
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
      const near = away >= REACH ? 0 : smoothstep(1 - away / REACH);

      /*
       * Out of reach: let go, and disarm with it. Drifting back inside the
       * 110px doesn't restart it — only another hover does.
       */
      if (near === 0) {
        armed = false;
        if (!resting) letGo();
        return;
      }

      /*
       * The geometric half of the gate: the pointer is on the box. The
       * `pointerenter` listener below is the half that normally fires, and
       * it's the more reliable one — the browser hit-tests every event, where
       * this sees one pointer position per frame and a fast enough flick
       * across the photo lands either side of it. This covers the case the
       * listener can't: the page scrolling the frame up under a pointer that
       * hasn't moved at all.
       */
      if (!armed) {
        if (away > 0) return;
        armed = true;
        armedAt = now;
      }

      /* Eased in from nothing rather than landing on full travel in the one
         frame the pointer crosses the edge. See the note at the top. */
      const k = near * smoothstep(Math.min((now - armedAt) / ENTER_MS, 1));

      /*
       * Direction to the pointer, each axis saturating at +/-1 about 60px
       * outside the frame rather than at the edge of reach. With the hover
       * gate that divisor is most of what anyone ever feels: a pointer on
       * the photo's own edge is already ~0.6 of the way over, so the lean
       * answers a cursor crossing the picture rather than only building once
       * it has left it.
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

      /*
       * Keep the frames coming until the ease-in is done. Someone who puts
       * the pointer on the photo and holds it still gets one `pointermove`
       * and then nothing, and the ramp has to finish without them.
       */
      if (now - armedAt < ENTER_MS) queued = requestAnimationFrame(draw);
    };

    const onMove = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (!queued) queued = requestAnimationFrame(draw);
    };

    /*
     * What arms it, and the whole of the fourth request: pointing at the
     * photo is the trigger now.
     *
     * On this element rather than a hit test inside `draw`, so the browser
     * does the hit-testing. `pointerenter` fires on an element when the
     * pointer enters it *or any descendant*, so the photo, the frame band and
     * the DVD logo bouncing around inside it are all the same door — and so
     * are the walls, which keep their pointer events like every other solid's.
     */
    const onEnter = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (!armed) {
        armed = true;
        armedAt = performance.now();
      }
      if (!queued) queued = requestAnimationFrame(draw);
    };

    /* Scrolling moves the frame under a pointer that hasn't moved at all. */
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(draw);
    };

    frame.addEventListener("pointerenter", onEnter);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      frame.removeEventListener("pointerenter", onEnter);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (queued) cancelAnimationFrame(queued);
      letGo();
    };
  }, []);

  return (
    <div ref={el} className={tracking ? `${className} solid-track` : className}>
      {children}
    </div>
  );
}
