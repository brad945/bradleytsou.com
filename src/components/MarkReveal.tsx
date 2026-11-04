"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HIT_IFRAME_MS,
  PELLET_MS,
  PELLET_PX,
  type ProbeRef,
  type Shot,
} from "@/lib/mark-hit";

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
 * What a hit on either glyph does: go to the top of the profile.
 *
 * **This is a function because the anchor that used to do it is gone** — see
 * the note on the box below. Replacing `href="/#top"` with
 * `location.assign("/#top")` would have been the literal translation and is
 * subtly worse: assigning a URL whose hash is already current doesn't
 * re-scroll, so a second hit would do nothing on a page the reader had
 * scrolled back down.
 *
 * So on `/` it scrolls and keeps the hash in the address bar in step, and
 * anywhere else it is a real navigation. `scrollTo` is called without
 * `behavior`, which leaves it to the CSS `scroll-behavior` on `html` — that's
 * what keeps the `prefers-reduced-motion` opt-out there working rather than
 * hardcoding smooth here and overriding it.
 */
function goTop() {
  if (window.location.pathname !== "/") {
    window.location.assign("/#top");
    return;
  }
  window.scrollTo({ top: 0 });
  if (window.location.hash !== "#top") {
    window.history.replaceState(null, "", "/#top");
  }
}

/**
 * The pellets, in flight across the whole viewport.
 *
 * **Portalled to `document.body`, which is not optional.** The box each half
 * lives in carries a `translate-x-*` for the slide, and a transformed
 * ancestor becomes the containing block for `position: fixed` descendants —
 * so a full-viewport layer rendered inside a `Half` would be a layer the
 * width of one black column, and it would slide. That is the same trap the
 * Tech Stack confetti is portalled to avoid.
 *
 * **DOM circles rather than three.js.** The pellet has to cross the page, and
 * each canvas is 225px wide and clipped to its own column — an object in
 * either scene physically cannot leave it. A third full-screen canvas for
 * three spheres would be 269kB of renderer for something `border-radius` and
 * one `backgroundImage` token already draw.
 *
 * Animated with the Web Animations API rather than a CSS transition, because
 * the arrival is what triggers the hit: `.finished` is a promise that resolves
 * on the real end of the animation, where a transition would need a listener
 * and a guess at which property ended.
 */
function Pellets({
  shots,
  onLand,
}: {
  shots: Shot[];
  onLand: (id: number) => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;

  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      {shots.map((s) => (
        <Pellet key={s.id} shot={s} onLand={onLand} />
      ))}
    </div>,
    host,
  );
}

function Pellet({
  shot,
  onLand,
}: {
  shot: Shot;
  onLand: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(
      [
        { transform: "translate3d(0,0,0)" },
        { transform: `translate3d(${shot.dx}px, ${shot.dy}px, 0)` },
      ],
      { duration: PELLET_MS, easing: "linear", fill: "forwards" },
    );
    let live = true;
    anim.finished
      .then(() => {
        if (live) onLand(shot.id);
      })
      .catch(() => {});
    return () => {
      live = false;
      anim.cancel();
    };
    /* `shot` is created once per pellet and never mutated, so this runs once;
       re-running it would restart a pellet mid-flight. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className="absolute rounded-full bg-pellet"
      style={{
        left: shot.x - PELLET_PX / 2,
        top: shot.y - PELLET_PX / 2,
        width: PELLET_PX,
        height: PELLET_PX,
      }}
    />
  );
}

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
  hitAt,
  probeRef,
  onFire,
}: {
  side: "left" | "right";
  open: boolean;
  onReady: () => void;
  /** Right half only: timestamp of the pellet that just landed. */
  hitAt?: number;
  probeRef?: ProbeRef;
  /** Left half only: the gun went off. */
  onFire?: () => void;
}) {
  const right = side === "right";

  /*
   * ## Why the gun arms on hover and releases on leaving the whole box
   *
   * **A geometry-only hover flickers, and it is a loop rather than a
   * wobble.** Rolling the `b` 90° moves the stem out from under a stationary
   * pointer; the next `pointermove` raycasts a miss, so it unrolls; the stem
   * comes back under the pointer; it rolls again. CLAUDE.md records the same
   * loop for the solids, where a lifted box moved out from under the pointer
   * that lifted it — and the fix is the same one `AvatarPrism` uses: a hover
   * *arms* it and something coarser releases it. Here that is `pointerleave`
   * on the box, which the roll cannot move.
   *
   * It also fixes a second problem for free. After the roll the glyph is
   * somewhere else, so the pointer that triggered it is usually over empty
   * space — and a geometry-only click would then do nothing, which reads as
   * broken. While armed, a click anywhere in this box fires. Arming still
   * costs a hover on the mark itself, so the isolation holds: you cannot fire
   * a gun you never touched.
   */
  const [armed, setArmed] = useState(false);
  const [popAt, setPopAt] = useState<number>();
  const gun = !!onFire;
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

        2500ms with a back-eased curve: it should arrive like something pushed
        out rather than something faded in.

        **The duration is written as an arbitrary value, and the figure is
        deliberately not spelled as a class name anywhere in these comments.**
        Tailwind's scanner reads source as plain text, comments included, so an
        arbitrary-value class mentioned in prose is emitted as a real, dead
        rule. That has happened twice in this repo.

        **Set outright now, after four rounds of factors.** "make slide
        duration 2500 ms" — a duration in milliseconds, so there is nothing to
        convert and nothing to get backwards.

        That is worth keeping, because the four before it were all factors on
        the *speed*, which act on this number by their reciprocal: 700 ->
        700 / 0.75 = 933 ("75% speed"), -> 933 x 4 = 3732 ("75% slower", the
        literal quarter-speed reading rather than the looser "75% longer",
        which would have been 1633), -> 3732 / 1.2 = 3110 ("1.2x faster"),
        -> 2500. Faster makes this smaller and slower makes it bigger; getting
        that inverted carries a 4x error, which is why it was written down.

        The path 933 -> 3732 -> 3110 -> 2500 also says something the individual
        asks don't: the quarter-speed step overshot, and 2500 is close to the
        1633 the other reading of it would have given. If this moves again,
        somewhere in 1600-2500 is where it has been converging.
      */}
      {/*
        **A div, and it used to be an `<a href="/#top">`.** Bradley: "can u
        make it so that the 'b' and 't.' are like isolated, why can i 'click
        them' when im not hovering directly over them". The box is as tall as
        the reveal needs and the glyph fills a fraction of it, so an anchor
        here made every pixel of the surround a link.

        **`pointer-events-none` on the anchor would not have fixed it.** A
        click on a DOM descendant activates its ancestor anchor whatever that
        ancestor's `pointer-events` is, and the anchor also claimed the
        pointer cursor and the status-bar URL preview across the whole box —
        which is the symptom as he described it. So the element goes and the
        intent moves to `onPick`, which r3f fires only on a ray that hits the
        glyph's own geometry.

        The box keeps `pointer-events-auto`: r3f needs real DOM events on the
        canvas to raycast at all. What changed is that landing one no longer
        means anything unless it hits the mark.

        Still the nav's home target while the gesture is up, now via
        `goTop()` — same `/#top`, same reason: `top` is a fragment the spec
        resolves to the document top, so it lands without the ~56px jolt
        `#profile` caused. Escape still dismisses, so this isn't the only way
        out.
      */}
      <div
        onTransitionEnd={() => setSettled(true)}
        onPointerLeave={gun ? () => setArmed(false) : undefined}
        onClick={
          gun
            ? () => {
                if (!armed) return;
                setPopAt(performance.now());
                onFire?.();
              }
            : undefined
        }
        className={`pointer-events-auto block h-[40vh] max-h-[380px] w-full transition-transform duration-[2500ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
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
        {/*
          The `b` no longer navigates — it is the gun, and `goTop` on it would
          scroll the page to the top on every shot. The `t.` keeps the home
          link, so the gesture still has one.
        */}
        <Model3D
          mode="follow"
          glyph={right ? "t" : "b"}
          zoom={1.35}
          onReady={onReady}
          onPick={gun ? undefined : goTop}
          onArm={gun ? () => setArmed(true) : undefined}
          roll={gun ? armed : undefined}
          popAt={gun ? popAt : undefined}
          hitAt={hitAt}
          probeRef={probeRef}
          className="h-full w-full"
        />
      </div>
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

  /*
   * The gun's state lives up here because it spans both halves: the `b` fires
   * and the `t.` is what gets hit, and the pellets belong to neither box.
   */
  const gunProbe: ProbeRef = useRef(null);
  const targetProbe: ProbeRef = useRef(null);
  const nextId = useRef(0);
  const [shots, setShots] = useState<Shot[]>([]);
  const [hitAt, setHitAt] = useState<number>();

  /*
   * No pellets and no flash under `prefers-reduced-motion`, the same call
   * `Reactions` makes about its flying emoji and `TechStack` about its
   * confetti. The roll and the squash stay: those are responses to a pointer
   * on a thing, which is the line the rest of this site's motion sits on.
   */
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  /*
   * Fire: read both probes *now* and freeze the flight path.
   *
   * The pellet travels in page space while both glyphs keep moving — the
   * follow yaws them at the cursor and `Float` bobs them — so the path is
   * sampled at the trigger and not tracked. A pellet that homed would be a
   * missile rather than a bullet, and the `t.` would never be missable.
   */
  const fire = () => {
    if (reduced) return;
    /* One ref per half: both canvases project their own anchors, so a shared
       ref would have each overwriting the other's every frame. */
    const from = gunProbe.current?.muzzle;
    const to = targetProbe.current?.impact;
    if (!from || !to) return;
    setShots((s) => [
      ...s,
      {
        id: nextId.current++,
        x: from.x,
        y: from.y,
        dx: to.x - from.x,
        dy: to.y - from.y,
      },
    ]);
  };

  /*
   * Landing: drop the pellet and hurt the `t.` — unless it is already hurt.
   *
   * The i-frame is `HIT_RED_MS` in `Model3D` and it is why `hitAt` is only
   * re-set when the previous window has expired. Minecraft has the same
   * cooldown; without it, clicking fast restarts the white frame on every
   * landing and the glyph strobes.
   */
  const land = (id: number) => {
    setShots((s) => s.filter((x) => x.id !== id));
    setHitAt((prev) => {
      const now = performance.now();
      return prev && now - prev < HIT_IFRAME_MS ? prev : now;
    });
  };

  return (
    <>
      <Half
        side="left"
        open={open}
        onReady={onReady}
        probeRef={gunProbe}
        onFire={fire}
      />
      <Half
        side="right"
        open={open}
        onReady={onReady}
        probeRef={targetProbe}
        hitAt={hitAt}
      />
      <Pellets shots={shots} onLand={land} />
    </>
  );
}
