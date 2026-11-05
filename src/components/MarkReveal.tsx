"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  KEY_DISARM_MS,
  KNOCK_SLING,
  PELLET_MS,
  PELLET_PX,
  ROLL_LEAD_MS,
  SLING_MS,
  VAULT,
  VAULT_HEADROOM,
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
  onLand: (id: number, hits: "b" | "t") => void;
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

/** How many samples the vault is drawn with. Flat shots need two. */
const ARC_STEPS = 24;

/**
 * The flight path, as keyframes.
 *
 * A bullet is two frames and a straight line. The stone is a real ballistic
 * arc: horizontal position is linear in time and vertical carries `4t(1-t)`
 * on top of it, which is the parabola through both ends with its apex at the
 * midpoint. Sampling it at evenly spaced keyframes under `linear` easing is
 * what makes the stone visibly slowest over the top without anything easing
 * it — that is the shape of the maths, not a curve chosen to look like it.
 */
function path(shot: Shot): Keyframe[] {
  if (!shot.arc) {
    return [
      { transform: "translate3d(0,0,0)" },
      { transform: `translate3d(${shot.dx}px, ${shot.dy}px, 0)` },
    ];
  }
  return Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
    const t = i / ARC_STEPS;
    const x = shot.dx * t;
    const y = shot.dy * t - shot.arc * 4 * t * (1 - t);
    return { transform: `translate3d(${x}px, ${y}px, 0)` };
  });
}

function Pellet({
  shot,
  onLand,
}: {
  shot: Shot;
  onLand: (id: number, hits: "b" | "t") => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(path(shot), {
      duration: shot.ms,
      easing: "linear",
      fill: "forwards",
    });
    let live = true;
    anim.finished
      .then(() => {
        if (live) onLand(shot.id, shot.hits);
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
        left: shot.x - shot.r,
        top: shot.y - shot.r,
        width: shot.r * 2,
        height: shot.r * 2,
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
  dotGone,
}: {
  side: "left" | "right";
  open: boolean;
  onReady: () => void;
  /** Timestamp of the projectile that just landed on this glyph. */
  hitAt?: number;
  probeRef?: ProbeRef;
  /** Fire this half's weapon. Returns false if it had nothing to fire. */
  onFire?: () => boolean;
  /** Right half only: the stone is mid-flight, so the `.` isn't drawn. */
  dotGone?: boolean;
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
  /*
   * Both halves are armed now — the `b` is a gun and the `t.` a catapult —
   * so what used to be "is this the gun half" is just "does it have a
   * weapon", and the side decides which one. The `t.` gave up its home link to get
   * it: a glyph that fires cannot also navigate, or every throw leaves the
   * page. Escape still dismisses the reveal, which is the way out.
   */
  const armable = !!onFire;
  const weapon = right ? "catapult" : "gun";

  /*
   * Whether the pointer is anywhere in this half's box. Only the keyboard
   * path reads it — see the disarm timer below.
   */
  const inBox = useRef(false);

  /** `armed`, readable from an event handler without re-binding it. */
  const isArmed = useRef(false);
  isArmed.current = armed;

  /*
   * Pull the trigger, and only pose if something actually left. An empty
   * catapult used to swing its arm for nothing; now `onFire` says whether it
   * fired and the squash or the swing follows that rather than the click.
   */
  const trigger = useRef<() => void>(() => {});
  trigger.current = () => {
    if (onFire?.()) setPopAt(performance.now());
  };

  /*
   * **`b` fires the gun and `t` the catapult**, at Bradley's request — "for
   * ease of clicking". The listener lives here rather than in the parent
   * because everything it needs is local: this half already knows its glyph,
   * its armed state and its own weapon.
   *
   * Three details it would be wrong without. A keypress has no hover, so it
   * has to arm as well as fire, and it waits `ROLL_LEAD_MS` for the roll
   * when it was the thing that armed it — otherwise the `b` launches from a
   * muzzle still swinging up from the top of the glyph. Auto-repeat is
   * ignored, because holding the key down is ~30 shots a second rather than
   * a fast player. And a modifier means the browser's own shortcut, which
   * `Cmd-T` makes obvious.
   *
   * It is bound to the window rather than to the box: the reveal takes no
   * focus, and the box is `aria-hidden` chrome that nothing can tab into, so
   * there is no element here for a key event to arrive at.
   */
  useEffect(() => {
    if (!armable) return;
    const key = right ? "t" : "b";
    let shot: number | undefined;
    let disarm: number | undefined;

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== key) return;
      /* Never steal a key from somewhere it is being typed. */
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? ""))
      )
        return;

      window.clearTimeout(disarm);
      window.clearTimeout(shot);
      /* Read the arm state off a ref, never from inside a state updater: an
         updater must be pure, and StrictMode runs it twice — which would be
         two shots per press in development and one in production. */
      shot = window.setTimeout(
        () => trigger.current(),
        isArmed.current ? 0 : ROLL_LEAD_MS,
      );
      setArmed(true);
      disarm = window.setTimeout(() => {
        if (!inBox.current) setArmed(false);
      }, KEY_DISARM_MS);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(shot);
      window.clearTimeout(disarm);
    };
  }, [armable, right]);
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

        **The reveal has no home link any more, and that is the cost of the
        second weapon.** The `b` gave its click to the gun and the `t.` has
        now given its click to the catapult, so there is no glyph left to
        carry `/#top`. Escape dismisses the whole thing, the nav's own `bt.`
        already links home, and a click that both threw a stone and navigated
        would be neither.
      */}
      <div
        onTransitionEnd={() => setSettled(true)}
        onPointerEnter={armable ? () => (inBox.current = true) : undefined}
        onPointerLeave={
          armable
            ? () => {
                inBox.current = false;
                setArmed(false);
              }
            : undefined
        }
        onClick={
          armable
            ? () => {
                if (armed) trigger.current();
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
        <Model3D
          mode="follow"
          glyph={right ? "t" : "b"}
          zoom={1.35}
          onReady={onReady}
          onArm={armable ? () => setArmed(true) : undefined}
          pose={weapon}
          roll={armable ? armed : undefined}
          popAt={armable ? popAt : undefined}
          hitAt={hitAt}
          /* Each is hit from the other's side, so the shoves run opposite. */
          knockDir={right ? 1 : -1}
          knockScale={right ? 1 : KNOCK_SLING}
          dotGone={dotGone}
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
  /* One timestamp per glyph: each is now both a weapon and a target. */
  const [hitT, setHitT] = useState<number>();
  const [hitB, setHitB] = useState<number>();
  /*
   * Whether the catapult's stone is away. The `.` is a real part of the `t.`,
   * so while it is crossing the page it must not also be on the glyph — and
   * with no stone there is nothing to throw, which is what stops the catapult
   * being spammable the way the gun is. It comes back on landing.
   */
  const [dotGone, setDotGone] = useState(false);

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
  const launch = (
    from: { x: number; y: number } | undefined,
    to: { x: number; y: number } | undefined,
    rest: { r: number; ms: number; hits: "b" | "t"; arc: number },
  ) => {
    if (!from || !to) return false;
    setShots((s) => [
      ...s,
      {
        id: nextId.current++,
        x: from.x,
        y: from.y,
        dx: to.x - from.x,
        dy: to.y - from.y,
        ...rest,
      },
    ]);
    return true;
  };

  const fireGun = () => {
    if (reduced) return false;
    /* One ref per half: both canvases project their own anchors, so a shared
       ref would have each overwriting the other's every frame. */
    return launch(gunProbe.current?.muzzle, targetProbe.current?.impact, {
      r: PELLET_PX / 2,
      ms: PELLET_MS,
      hits: "t",
      /* Flat. A bullet goes where it is pointed. */
      arc: 0,
    });
  };

  /*
   * The catapult: throw the `.` itself at the `b`.
   *
   * **The stone's radius is projected, not assumed.** `sling` and `slingEdge`
   * are a radius apart inside the dot, so the gap between them on screen is
   * what the `.` actually renders at — which changes with the canvas, and
   * would be a guess at any fixed number. Falling back to the pellet's size
   * would be visibly wrong: the `.` is about four times a pellet across.
   */
  const fireCatapult = () => {
    if (reduced || dotGone) return false;
    const from = targetProbe.current?.sling;
    const edge = targetProbe.current?.slingEdge;
    const to = gunProbe.current?.impact;
    if (!from || !edge || !to) return false;
    const r = Math.hypot(edge.x - from.x, edge.y - from.y) || PELLET_PX / 2;
    /*
     * The vault, clamped so the top of the arc stays on screen. The rise is a
     * fraction of the span it crosses, so it scales with the window instead
     * of being a number tuned against one; the clamp only bites on a short
     * window, where a proportional arc would otherwise leave through the top
     * of a layer that is `fixed inset-0` and therefore clips it.
     */
    const apex = (from.y + to.y) / 2;
    const arc = Math.max(
      0,
      Math.min(Math.abs(to.x - from.x) * VAULT, apex - VAULT_HEADROOM),
    );
    if (!launch(from, to, { r, ms: SLING_MS, hits: "b", arc })) return false;
    setDotGone(true);
    return true;
  };

  /*
   * Landing: drop the pellet and hurt the `t.`, every time, with no cooldown.
   *
   * "make the t 'hit' animation update per incoming bullet even if its mid
   * animation" — so a pellet arriving mid-flash restarts it rather than being
   * absorbed. See the note in `mark-hit`, which is where the invulnerability
   * window used to be.
   *
   * `hitAt` has to *change* for `Hurt` to see a new hit, and it compares by
   * value, so two pellets landing in the same sub-millisecond tick would read
   * as one. Nudging past the previous value keeps it strictly increasing, so
   * no landing is ever silently swallowed.
   */
  const land = (id: number, hits: "b" | "t") => {
    setShots((s) => s.filter((x) => x.id !== id));
    const bump = (prev: number | undefined) => {
      const now = performance.now();
      return prev !== undefined && now <= prev ? prev + 0.01 : now;
    };
    if (hits === "t") {
      setHitT(bump);
    } else {
      setHitB(bump);
      /* The stone is spent: put it back on the `t.`, which fades it in. */
      setDotGone(false);
    }
  };

  return (
    <>
      <Half
        side="left"
        open={open}
        onReady={onReady}
        probeRef={gunProbe}
        onFire={fireGun}
        hitAt={hitB}
      />
      <Half
        side="right"
        open={open}
        onReady={onReady}
        probeRef={targetProbe}
        onFire={fireCatapult}
        hitAt={hitT}
        dotGone={dotGone}
      />
      <Pellets shots={shots} onLand={land} />
    </>
  );
}
