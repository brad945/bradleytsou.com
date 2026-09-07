"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * The 3D mark, sliding out from behind the profile block into the left column.
 *
 * Second half of the gesture `NavMark` starts: the flat glyphs fall out of the
 * nav and disappear behind the profile column, and half a second later the
 * same mark comes back out of that column in three dimensions.
 *
 * ## Why it reads as "from behind", and why that needs `-z-10`
 *
 * The falling glyphs get this for free: the nav and `<main>` are both in-flow
 * blocks, so document order decides and `<main>` paints later. **This does
 * not**, and the difference is easy to miss. A positioned element with
 * `z-index: auto` paints in a *later step* than in-flow block content — CSS
 * painting order puts in-flow blocks at step 3 and positioned descendants at
 * step 6 — so a `fixed` box mounted before `<main>` still lands on top of it.
 * `-z-10` moves it to step 2, behind in-flow content and in front of the
 * body's background, which is where it has to be.
 *
 * With that, it starts translated fully right of its own box — under the
 * opaque profile column — and sliding left is the model emerging from
 * underneath. Nothing is clipped.
 *
 * ## Why it is gated on width
 *
 * The thing it slides into is the black surround, which is
 * `(100vw - 990px) / 2` wide — 205px at 1400, and nothing at all below about
 * 1050 where the column fills the viewport. Under `MIN_VW` there is nowhere
 * for it to go, so the fall still happens and this doesn't. That's a real
 * limitation of the idea rather than of the implementation: the effect needs
 * a wide window.
 *
 * ## Why three.js isn't in the bundle
 *
 * `dynamic(..., { ssr: false })` and, more importantly, this only renders
 * *after* the gesture. The profile page is 104 kB and three.js is 269 kB — a
 * static import would have nearly quadrupled the cost of a page for something
 * most visitors never trigger. The chunk is fetched on the trigger, which is
 * also why the reveal waits 500ms: that is roughly how long the chunk takes,
 * so the wait is doing double duty.
 *
 * `ssr: false` is separately required — `<Canvas>` reaches for a WebGL context
 * on mount and a server hasn't got one.
 */

const Model3D = dynamic(() => import("@/components/Model3D"), { ssr: false });

/** Below this the black column is too narrow to slide anything into. */
const MIN_VW = 1180;

export default function MarkReveal() {
  const [state, setState] = useState<"idle" | "out">("idle");
  /*
   * Separate from `state` on purpose. Mounting an element already in its final
   * position transitions nothing — the browser has no previous value to
   * interpolate from. So it mounts closed, and `open` flips on the next frame,
   * which is the change the transition actually runs on.
   *
   * `requestAnimationFrame` twice, not once: one frame schedules the paint,
   * and the style has to have been *computed* in a frame before the change to
   * be interpolable. A single rAF batches with the mount often enough to drop
   * the animation intermittently, which is worse than dropping it always.
   */
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const reveal = () => {
      if (window.innerWidth >= MIN_VW) setState("out");
    };
    window.addEventListener("bt:reveal", reveal);
    return () => window.removeEventListener("bt:reveal", reveal);
  }, []);

  useEffect(() => {
    if (state !== "out") {
      setOpen(false);
      return;
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setOpen(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [state]);

  /*
   * Escape dismisses it and puts the mark back, the same key that closes the
   * alias dropdown, the ⋯ menu and Exy. Bound only while it's out, so this
   * isn't a listener sitting on every keystroke for a thing that isn't there.
   */
  useEffect(() => {
    if (state !== "out") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setState("idle");
        window.dispatchEvent(new CustomEvent("bt:reset"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (state === "idle") return null;

  return (
    /*
      Pinned to the left half of the viewport and vertically centred on the
      profile block. `pointer-events-none` on the frame so the black surround
      stays inert — only the model itself takes the pointer, which is what
      makes dragging it work without turning the whole column into a target.
    */
    <div
      aria-hidden
      className="pointer-events-none fixed inset-y-0 left-0 -z-10 hidden w-[calc((100vw-990px)/2+120px)] items-center justify-start xl:flex"
    >
      {/*
        The slide. The box overlaps the profile column by 120px so the model
        starts genuinely underneath it rather than just off its edge, and
        `translate-x-full` clears that whole width.

        **Height is set to keep the canvas from being too portrait.** The
        camera's field of view is vertical, so a tall narrow canvas fits the
        model to its height and then runs out of width — at 62vh the mark was
        cut off by the left edge of the screen. 40vh is close enough to the
        column's own proportions that it fits inside it.

        `duration-700` with a back-eased curve: it should arrive like something
        pushed out rather than something faded in.
      */}
      <div
        className={`pointer-events-auto h-[40vh] max-h-[380px] w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={() => {
          setState("idle");
          window.dispatchEvent(new CustomEvent("bt:reset"));
        }}
      >
        <Model3D className="h-full w-full" />
      </div>
    </div>
  );
}
