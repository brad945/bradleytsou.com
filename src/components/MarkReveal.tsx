"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { profile } from "@/lib/profile-data";

/**
 * The 3D mark, cut in half and sliding out from behind the profile block into
 * *both* columns — the `b` into the left one, the `t.` into the right.
 *
 * Second half of the gesture `NavMark` starts: the flat glyphs fall out of the
 * nav and disappear behind the profile column, and half a second later the
 * same mark comes back out of that column in three dimensions.
 *
 * ## Why two halves rather than one mark
 *
 * Bradley's: "instead of popping out from behind the main center column,
 * separate the characters and have just 'b' on the left but then 't' on the
 * right (both of them pop out from behind the middle column at the same time
 * and have t essentially be a reflection of b in terms of how it follows the
 * mouse cursor)."
 *
 * So the column isn't a thing the mark comes *out of* on one side any more —
 * it's the thing the mark was hiding *behind*, and it breaks either way. The
 * three parts that make that read:
 *
 * - **They leave together.** Each half is its own `<Canvas>` and WebGL takes
 *   as long as it takes, so the two `onReady`s land whenever they land.
 *   Opening on the first would start one half moving while the other was
 *   still a blank box — so both wait for both. See `ready` below.
 * - **They leave in opposite directions**, each from under the column edge it
 *   is parked behind: the left half closed is `translate-x-full` and the
 *   right half `-translate-x-full`.
 * - **The cursor-following mirrors itself**, which is the part that needed
 *   no code. `Spin` measures the pointer from each canvas's own centre, so
 *   two halves at mirrored x respond antisymmetrically on their own: each
 *   turns toward the cursor and the pair is symmetric about the page. A flag
 *   negating the right half's yaw was written first and was exactly wrong —
 *   it made both halves turn the same way, which is a copy rather than a
 *   reflection. Nothing flips the glyph either; the `t` is a `t`.
 *
 * Two canvases is two WebGL contexts and two `<Environment>`s, and that is
 * the knowing cost. The map is cached by URL, so the second is a cache hit
 * rather than a second megabyte; the alternative — one canvas spanning the
 * viewport with a mesh at each end — would put a transparent canvas across
 * the profile column, which is the pointer-events problem the note below
 * already describes, on purpose, at full width.
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
 * What they slide into is the black surround, which is
 * `(100vw - 990px) / 2` wide on each side — 205px at 1400, and nothing at all
 * below about 1050 where the column fills the viewport. Under `MIN_VW` there
 * is nowhere for them to go, so the fall still happens and this doesn't.
 * That's a real limitation of the idea rather than of the implementation: the
 * effect needs a wide window. The two surrounds are the same width by
 * construction, so one threshold still covers both.
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

/**
 * One half of the mark, in one of the two black columns.
 *
 * `open` is owned by the parent so both halves move on the same tick; the
 * settle is owned here, because it's about this box's own transition ending.
 */
function Half({
  side,
  open,
  onReady,
}: {
  side: "left" | "right";
  open: boolean;
  onReady: () => void;
}) {
  const right = side === "right";
  /*
   * Raised above the content once it has arrived — see the note on the
   * wrapper below. Separate from `open` because the two happen a slide apart.
   * It's driven by `onTransitionEnd` rather than a timer, so it tracks the
   * duration on its own and nothing here needs changing when that moves.
   */
  const [settled, setSettled] = useState(false);

  return (
    /*
      Pinned to one edge of the viewport and vertically centred on the profile
      block. `pointer-events-none` on the frame so the black surround stays
      inert — only the model itself takes the pointer, which is what makes
      dragging it work without turning the whole column into a target.

      The two sides are written out rather than built, because Tailwind's
      scanner reads this file as text and can't see a class name assembled at
      runtime. Both arms of each ternary are literal for that reason.
    */
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-y-0 hidden w-[calc((100vw-990px)/2)] items-center justify-center xl:flex ${
        right ? "right-0" : "left-0"
      } ${settled ? "z-10" : "-z-10"}`}
    >
      {/*
        The slide. The box is exactly the black column's width, so the model
        sits centred in it — an earlier version overlapped the profile column
        by 120px to guarantee the closed position was hidden, and the cost was
        that the open position was 60px off-centre and bleeding under the
        panel. It doesn't need the overlap: a full-width translate lands it
        exactly on the profile column's near edge and therefore under it.

        **Height is set to keep the canvas from being too portrait.** The
        camera's field of view is vertical, so a tall narrow canvas fits the
        model to its height and then runs out of width — at 62vh the mark was
        cut off by the edge of the screen. 40vh is close enough to the
        column's own proportions that it fits inside it. A single glyph is
        about half the width of the whole mark and very nearly its full
        height, so the fit is governed by the same number it always was and
        the zoom didn't need re-tuning.

        3732ms with a back-eased curve: it should arrive like something pushed
        out rather than something faded in.

        **The duration is written as an arbitrary value, and the figure is
        deliberately not spelled as a class name anywhere in these comments.**
        Tailwind's scanner reads source as plain text, comments included, so an
        arbitrary-value class mentioned in prose is emitted as a real, dead
        rule. That has happened twice in this repo.

        **Bradley has slowed this twice and the figures are not the same kind
        of arithmetic**, which is the thing to read carefully before touching
        it again. First: "make like 75% speed of what it is now", from 700 —
        75% *speed* is 1/0.75 of the duration rather than 0.75 of it, so
        700 / 0.75 = 933. Then, because 933 was still too fast: "make it 75%
        slower than what it is now", which is a reduction *of the speed* to a
        quarter, so 933 x 4 = 3732.

        That second step is the literal reading, and it was taken on purpose
        over the looser "75% longer" one (which would have been 1633): he had
        already called this too fast once after a 33% lengthening, so the risk
        of under-shooting again was the larger one. If 3732 overshoots, 1633
        is the other reading and this is the only number to change.
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
        className={`pointer-events-auto block h-[40vh] max-h-[380px] w-full transition-transform duration-[3732ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open
            ? "translate-x-0"
            : right
              ? "-translate-x-full"
              : "translate-x-full"
        }`}
      >
        {/*
          `zoom` pulls the camera back rather than scaling the element:
          scaling would blur the canvas, since it renders at its own pixel
          size.

          **No mirroring flag, and that isn't an omission.** `Spin` measures
          the cursor from each canvas's own centre, so two halves at mirrored
          x already turn symmetrically — each toward the cursor. See the note
          there; negating one half's yaw was tried and did the opposite.
        */}
        <Model3D
          mode="follow"
          glyph={right ? "t" : "b"}
          zoom={1.35}
          onReady={onReady}
          className="h-full w-full"
        />
      </a>
    </div>
  );
}

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
  /*
   * How many of the two halves have drawn a frame, and **both have to before
   * either moves.** Each is its own canvas, so WebGL setup finishes whenever
   * it finishes; opening on the first `onReady` would send one half out while
   * the other was still an empty box, and "both of them pop out from behind
   * the middle column at the same time" is the request.
   */
  const [ready, setReady] = useState(0);
  const open = ready >= 2;

  useEffect(() => {
    const reveal = () => {
      if (window.innerWidth >= MIN_VW) setState("out");
    };
    window.addEventListener("bt:reveal", reveal);
    return () => window.removeEventListener("bt:reveal", reveal);
  }, []);

  /* Back to idle unmounts both halves, so only the count needs resetting. */
  useEffect(() => {
    if (state !== "out") setReady(0);
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

  const onReady = () => setReady((n) => n + 1);

  return (
    <>
      <Half side="left" open={open} onReady={onReady} />
      <Half side="right" open={open} onReady={onReady} />
    </>
  );
}
