"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { profile } from "@/lib/profile-data";

/**
 * The 3D mark, sliding out from behind the profile block into the left column.
 *
 * Second half of the gesture `NavMark` starts: the flat glyphs fall out of the
 * nav and disappear behind the profile column, and half a second later the
 * same mark comes back out of that column in three dimensions.
 *
 * ## Why it can't just stay behind everything
 *
 * `-z-10` is what puts it behind the profile column, and it is also why the
 * first version wasn't clickable. The content wrapper in `layout.tsx` is
 * `position: relative` and, being a block, spans the full width of the page —
 * including the black columns, where it is completely transparent. A
 * transparent positioned element still takes pointer events over its whole
 * box, so it sat on top of the model and swallowed every click.
 *
 * So the depth is temporary. It is `-z-10` while it slides, which is the only
 * time it overlaps anything, and `z-10` once it has arrived — by then it is
 * out in the column with nothing to be behind, so raising it changes no
 * pixels and hands back the clicks.
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

/**
 * Below this the black column is too narrow to slide anything into.
 *
 * **Kept equal to `MIN_VW` in `NavMark`**, which is where the gesture starts.
 * If this were the higher of the two the glyphs would fall and nothing would
 * follow, which is the dead end that putting the reveal on every page was
 * meant to remove.
 */
const MIN_VW = 1180;

export default function MarkReveal() {
  const [state, setState] = useState<"idle" | "out">("idle");
  /*
   * Separate from `state`, and flipped by the model rather than by a timer.
   *
   * Mounting an element already in its final position transitions nothing —
   * there's no previous value to interpolate from — so it mounts closed and
   * opens afterwards. The first version opened it on the next animation frame,
   * and that was wrong in a way that looked like "no animation at all":
   * `dynamic()` mounts the component, but fetching the chunk, initialising
   * WebGL and drawing frame one all happen after that. The box slid on
   * schedule while empty, finished, and *then* the model appeared — at its
   * destination, having visibly travelled nowhere.
   *
   * `Model3D` reports `onReady` once it has actually rendered, and the slide
   * starts from there. Slower to begin, but it's the model that moves.
   */
  const [open, setOpen] = useState(false);
  /*
   * Raised above the content once it has arrived — see the note on the wrapper
   * below. Separate from `open` because the two happen 700ms apart.
   */
  const [settled, setSettled] = useState(false);

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
      setSettled(false);
    }
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
      className={`pointer-events-none fixed inset-y-0 left-0 hidden w-[calc((100vw-990px)/2)] items-center justify-center xl:flex ${
        settled ? "z-10" : "-z-10"
      }`}
    >
      {/*
        The slide. The box is exactly the black column's width, so the model
        sits centred in it — an earlier version overlapped the profile column
        by 120px to guarantee the closed position was hidden, and the cost was
        that the open position was 60px off-centre and bleeding under the
        panel. It doesn't need the overlap: `translate-x-full` moves it by its
        own width, which lands it exactly on the profile column's left edge and
        therefore under it.

        **Height is set to keep the canvas from being too portrait.** The
        camera's field of view is vertical, so a tall narrow canvas fits the
        model to its height and then runs out of width — at 62vh the mark was
        cut off by the left edge of the screen. 40vh is close enough to the
        column's own proportions that it fits inside it.

        `duration-700` with a back-eased curve: it should arrive like something
        pushed out rather than something faded in.
      */}
      {/*
        An anchor, because the flat mark it replaced was one and is now at the
        bottom of the page. This is the nav's home link for as long as the
        gesture is running — same `/#top` target, same reason: `top` is a
        fragment the spec resolves to the document top, so it needs no element
        and lands without the ~56px jolt `#profile` caused.

        Escape still dismisses and puts the flat mark back, so the link isn't
        the only way out.
      */}
      <a
        href="/#top"
        aria-label={`${profile.name} — home`}
        onTransitionEnd={() => setSettled(true)}
        className={`pointer-events-auto block h-[40vh] max-h-[380px] w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/*
          `zoom` pulls the camera back rather than scaling the element: scaling
          would blur the canvas, since it renders at its own pixel size.
        */}
        <Model3D
          mode="follow"
          zoom={1.35}
          onReady={() => setOpen(true)}
          className="h-full w-full"
        />
      </a>
    </div>
  );
}
