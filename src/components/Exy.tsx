"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HoverNote from "@/components/HoverNote";
import { createPortal } from "react-dom";

/**
 * Exy — Bradley's dog, as a controllable character.
 *
 * He hides behind the profile photo with only his tail showing. Click the tail
 * and he walks out: WASD moves him, his frames swap to match the direction
 * he's heading, and he grows walking toward you. Clicking him growls and
 * shakes. **Escape is what puts him away** — clicking used to and no longer
 * does.
 *
 * This is a real mechanic rather than decoration, which is the only reason it
 * belongs on a site whose brief bans ornamental motion: nothing here moves
 * unless a key is held. It's the same category as the planned bhop gate.
 *
 * ## The frames
 *
 * Cut from phone clips of the real dog, in `public/exy/`:
 *
 *   walk-front-1.png … walk-front-7.png   (walking toward the viewer)
 *   walk-side-1.png  … walk-side-7.png    (walking to the RIGHT)
 *   stand-side.png                        (standing still, side on)
 *   sit.png                               (idle facing you, and the fallback)
 *   growl.mp3
 *
 * **There is no back cycle** — that shot was dropped, so `CYCLE` maps walking
 * up the page onto the side frames. See the note there.
 *
 * One side cycle covers both directions: walking left is the right-facing
 * cycle mirrored with `scaleX(-1)`, which is why `CYCLE` carries `flip`. The
 * source clip has him walking right-to-left, so the PNGs were mirrored on the
 * way out — **he faces RIGHT in the files.**
 *
 * Every frame in a cycle shares one canvas size, and `sit.png` shares the
 * front canvas so he doesn't resize when he stops walking. That matters more
 * than image quality: inconsistent crops make him appear to jitter and rescale
 * as he moves, which reads as a bug rather than as rough art.
 */

/**
 * Where the frames live, and how many there are per cycle.
 *
 * **Seven, not six, because his real gait measured 21 frames at 60fps** and 21
 * divides evenly by 7. Six would have needed 3.5-frame spacing, i.e. a cycle
 * that stutters slightly at two of its six steps.
 */
const ASSETS = "/exy";
const WALK_FRAMES = 7;

/** Rendered height in px. The art is 2x this, which is all a 2x display uses. */
const SPRITE_PX = 104;

/**
 * He's drawn twice, one viewport-width apart, so the horizontal wrap is
 * seamless — as he leaves one edge the other copy is already arriving at the
 * opposite one, and no part of him is ever missing from the screen.
 *
 * Index 0 is the real one and carries the WASD hint; index 1 trails a viewport
 * to its left and is off screen entirely except while he's straddling an edge.
 */
const COPIES = [0, 1];

/**
 * Walking speed, px per second — **faster across than up and down.**
 *
 * Not a fudge: the two axes are different motions. Left and right he's
 * travelling across the page, and the side sprite shows a full stride, so it
 * wants to cover ground. Up and down he's walking toward or away from the
 * viewer, where most of his real movement is into the screen and only a little
 * of it registers as travel — so the same number reads far too fast there.
 *
 * Both are multiplied by his current scale in the loop, so these are his
 * speeds at 1x. Changing `SPEED_X` means re-deriving `WALK_FPS_SIDE`, or his
 * feet slide.
 */
const SPEED_X = 230;
const SPEED_Y = 120;

/**
 * How he grows walking toward the viewer and shrinks walking away.
 *
 * The vertical axis is depth, so scale is the only thing that can say which
 * way he's going — at a fixed size, walking down the page and walking up it
 * look identical. It's a rate rather than a step so the change reads as him
 * covering ground, and it persists when he stops, which a size tied to
 * "currently holding S" could not.
 *
 * 1.6 is where the 2x art starts to soften.
 */
const SCALE_MIN = 1;
const SCALE_MAX = 1.6;
/** Multiplier per second held. Only counts while the key is held alone. */
const SCALE_RATE = 0.5;

/**
 * How long he takes to walk clear of the photo, in ms.
 *
 * Derived, not chosen: the slot he crosses is 183px wide (`#exy-emerge` in
 * ProfileHeader) and he crosses it at `SPEED_X`, so 183/230 = 0.8s. **It must
 * match the `exy-emerge` animation's duration in tailwind.config.ts** — that
 * moves him, this decides when to hand off to free walking, and if they
 * disagree he jumps at the seam.
 */
const EMERGE_MS = 800;

/**
 * Frames per second of each walk cycle.
 *
 * **Side is not a taste value** — it's the one that stops his feet sliding. A
 * walk cycle has to advance at the rate the character actually travels, or he
 * moonwalks (too slow) or skates (too fast). Measured off the source clip: one
 * gait cycle is 21 frames at 60fps, over which he covers ~0.70 of his own body
 * length. Rendered here his body is ~150px, so a cycle should carry him
 * ~105px; at `SPEED_X` that takes 0.46s, and 7 frames in 0.46s is ~15fps.
 * **Tied to `SPEED_X` and to the sprite's proportions** — change either and
 * re-derive this.
 *
 * Front is free of that constraint and set by eye, faster. Head-on you can't
 * see a stride length, so there's no sliding to give it away; what you can see
 * is his legs, and at the side's rate they looked sluggish against how little
 * ground he covers on this axis.
 */
const WALK_FPS_SIDE = 15;
const WALK_FPS_FRONT = 18;

/**
 * Where he hides while asleep: an empty anchor rendered by `ProfileHeader`,
 * tucked behind the avatar frame so only his tail shows.
 *
 * He's portalled into it rather than positioned against it, so this component
 * still owns every bit of his state and `ProfileHeader` owns only the spot.
 * If the element isn't on the page — any route without a profile header — he
 * falls back to sitting in the corner.
 */
const DEN_ID = "exy-den";

/** Where he walks out from, on the photo's other edge. Also in ProfileHeader. */
const EMERGE_ID = "exy-emerge";

/** Rendered height of the tail, px. The art is 2x it. */
const TAIL_PX = 86;

/**
 * What he says when woken.
 *
 * A growl, because that's the recording Bradley had — the bark is still to
 * come. Named as a constant rather than inlined so swapping it is one edit and
 * so the filename doesn't claim to be a sound it isn't.
 */
const WAKE_SOUND = "growl.mp3";

/**
 * Keys, lowercased against `event.key`.
 *
 * **Arrows are bound as well as WASD, and that costs page scrolling** while
 * he's out: every key here is `preventDefault`ed, or the page would slide
 * under him as he walks. Escape puts him away and gives the arrows back. WASD
 * has no such cost, which is why the hint still names it.
 */
const KEY_DIRECTION: Record<string, "up" | "down" | "left" | "right"> = {
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
};

type Heading = "up" | "down" | "left" | "right";

/** Which cycle each heading uses, and whether it's mirrored. */
const CYCLE: Record<Heading, { name: "front" | "side"; flip: boolean }> = {
  /*
   * Walking up the page is walking away from the viewer, which wants a back
   * cycle — and there isn't one, because that clip was dropped as too awkward
   * to shoot.
   *
   * Side is the stand-in rather than front. A front-facing dog moving up the
   * page reads as moonwalking, because he'd be looking straight at you while
   * travelling away; side-on is directionally neutral and just reads as
   * moving. Shoot the back cycle and this becomes `{ name: "back" }` plus the
   * seven files.
   */
  up: { name: "side", flip: false },
  down: { name: "front", flip: false },
  right: { name: "side", flip: false },
  left: { name: "side", flip: true },
};

export default function Exy() {
  /*
   * Three phases rather than an awake flag, because emerging is neither: he's
   * on screen and animating, but he isn't controllable and isn't positioned by
   * the loop — he's still parented to the header, walking out from behind the
   * photo.
   */
  const [phase, setPhase] = useState<"asleep" | "emerging" | "awake">("asleep");
  const awake = phase === "awake";

  const [frame, setFrame] = useState(1);
  const [heading, setHeading] = useState<Heading>("down");
  const [walking, setWalking] = useState(false);

  /**
   * Whether he's ever been walked. Drives the hint, which is a one-time
   * instruction rather than a label — once you've moved him you know, and it
   * would just be a caption stuck to a dog from then on.
   *
   * Retired by a tap as well as a keypress now, since a tap is the other way
   * to drive him and on a phone it's the only one.
   *
   * Deliberately not reset by `sleep()`: putting him away doesn't make you
   * forget the controls. Not persisted either — a fresh page is a fresh
   * visitor as far as this is concerned, and a localStorage key for one hint
   * is more machinery than it's worth.
   */
  const [hasWalked, setHasWalked] = useState(false);

  /*
   * Whether this is a touch device, for the hint's wording only.
   *
   * `pointer: coarse` rather than a width check or a user-agent string: the
   * question is what the visitor is pointing with, and a narrow window on a
   * laptop still has a keyboard while a wide tablet doesn't.
   *
   * Read in an effect rather than during render, because the server has no
   * `matchMedia` and guessing would mean the first paint disagrees with the
   * second. It starts as false, which is the desktop wording — the hint is
   * `label`-sized and one word, so the correction is invisible.
   */
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  /** True for the length of one shake, after a click. */
  const [shaking, setShaking] = useState(false);

  /*
   * Three states, not two: `undefined` means "not looked yet". The lookup can
   * only run after mount, and rendering the corner fallback in the meantime
   * would flash a dog in the bottom-left for a frame before he jumped behind
   * the avatar. Staying null until we know avoids that.
   */
  const [slots, setSlots] = useState<
    { den: HTMLElement | null; emerge: HTMLElement | null } | undefined
  >(undefined);
  useEffect(
    () =>
      setSlots({
        den: document.getElementById(DEN_ID),
        emerge: document.getElementById(EMERGE_ID),
      }),
    [],
  );
  const den = slots?.den;

  /*
   * Position lives in a ref, not state: it changes every animation frame, and
   * putting it in state would re-render the tree ~60x a second. The ref drives
   * a transform written straight to the node instead.
   */
  const pos = useRef({ x: 0, y: 0 });
  /** One entry per copy in COPIES; index 0 is the real one. */
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  /** The inner box, which carries the scale so the outer keeps the position. */
  const bodies = useRef<(HTMLDivElement | null)[]>([]);
  const held = useRef(new Set<string>());
  /*
   * Where he's been sent, in page coordinates, or null.
   *
   * Tap-to-walk, for touch — there is no keyboard on a phone, so without this
   * he wakes up and then cannot be moved at all. Set by a tap anywhere on the
   * page; cleared when he arrives.
   *
   * A ref rather than state: the walk loop reads it every frame, and a
   * re-render per tap would do nothing except throw away the frame clock.
   */
  const target = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef<number | null>(null);
  const lastTick = useRef(0);
  const frameClock = useRef(0);
  /**
   * Size, in the same place as position and for the same reason: it changes
   * every frame while he's walking toward or away, and living in state would
   * re-render the tree ~60x a second.
   */
  const scale = useRef(1);

  /**
   * Keeps him reachable: wraps horizontally, clamps vertically.
   *
   * **The two axes differ because the edges mean different things.** Left and
   * right are just the sides of a viewport he's walking across, so looping
   * reads as the page being continuous. Up and down are the top and bottom of
   * the visible page, and a dog dropping off the bottom to reappear at the top
   * reads as falling, not as walking.
   *
   * The horizontal wrap is a modulo rather than a teleport-when-fully-gone,
   * which is what makes it seamless: `x` is always inside one viewport width,
   * and the second copy drawn a viewport to its left supplies the part that
   * has crossed the edge. He's never off screen and never cut short — the two
   * halves are always on at once. See `COPIES`.
   *
   * Height is scaled, or growing near the bottom would push him through it.
   */
  const contain = useCallback(() => {
    const width = window.innerWidth;
    const h = SPRITE_PX * scale.current;

    // `%` keeps the sign of the dividend in JS, so walking left off zero would
    // give a negative x and put both copies off screen. The double modulo
    // folds it back into [0, width).
    pos.current.x = ((pos.current.x % width) + width) % width;

    pos.current.y = Math.min(
      Math.max(pos.current.y, 0),
      window.innerHeight - h,
    );
  }, []);

  /**
   * Writes position and size straight to the DOM for every copy.
   *
   * Copy `i` sits `i` viewport-widths to the left of the real one, which is
   * what draws the part of him that has crossed the right edge back in at the
   * left. Only ever one of them is on screen unless he's mid-wrap, when both
   * are and together they show a whole dog.
   *
   * Position and scale are on separate elements. On one element they'd have to
   * share a transform, and `translate(...) scale(...)` scales about the box's
   * origin — with `origin-bottom` on the same node the translate would fight
   * the scale for what "bottom" means as he grows. Splitting them keeps the
   * outer purely positional.
   */
  const paint = useCallback(() => {
    const width = window.innerWidth;
    for (const i of COPIES) {
      const n = nodes.current[i];
      if (n) {
        n.style.transform = `translate3d(${pos.current.x - i * width}px, ${pos.current.y}px, 0)`;
      }
      const b = bodies.current[i];
      if (b) b.style.transform = `scale(${scale.current})`;
    }
  }, []);

  const wake = useCallback(() => {
    scale.current = 1;

    /*
     * He walks out from behind the photo rather than appearing beside it. That
     * happens in the header, parented to `#exy-emerge` — see the emerge effect
     * — so all this does is start the phase; the handoff to free walking sets
     * the position when he's clear.
     *
     * Without that slot (any page with no profile header) there's nothing to
     * walk out from, so he just turns up in the corner.
     */
    if (document.getElementById(EMERGE_ID)) {
      setHeading("right");
      setFrame(1);
      setPhase("emerging");
    } else {
      pos.current = { x: 24, y: window.innerHeight - SPRITE_PX - 24 };
      contain();
      setPhase("awake");
    }

    /*
     * Best-effort. Browsers block audio without a user gesture, but this only
     * ever runs from a click, so the catch is for a missing file rather than
     * for autoplay policy — a 404 on the mp3 shouldn't throw.
     */
    void new Audio(`${ASSETS}/${WAKE_SOUND}`).play().catch(() => {});
  }, [contain]);

  /**
   * Poke him: he growls and shakes it off.
   *
   * **This replaced click-to-dismiss.** Clicking a dog to make it go away was
   * the wrong verb for the thing on screen; Escape still puts him back behind
   * the photo, and that's now the only way, which is worth knowing.
   *
   * A fresh `Audio` each time rather than one reused element, so clicking
   * again while he's still growling overlaps instead of being ignored — a
   * reused element would need rewinding and would swallow rapid pokes.
   */
  const poke = useCallback(() => {
    void new Audio(`${ASSETS}/${WAKE_SOUND}`).play().catch(() => {});
    setShaking(true);
  }, []);

  /*
   * Tap the page and he walks there. The mobile answer to WASD, and it works
   * with a mouse too.
   *
   * Bound on the window rather than on an overlay, because an overlay big
   * enough to catch taps anywhere is an overlay over the whole page, and
   * everything under it stops being clickable.
   *
   * Three things are deliberately *not* a destination:
   *
   *   - anything inside a link, button or input. Sending him somewhere is a
   *     background gesture and must never be the reason a tap on a repo row
   *     didn't open it. `closest` rather than a tag check, because the target
   *     of a click on a link is usually the text node's element, not the `<a>`.
   *   - Exy himself, which is a poke — he has his own handler and this would
   *     otherwise fire alongside it and send him to where he already is.
   *   - a tap that's part of a text selection, which is a drag rather than a
   *     tap and would jump him mid-sentence.
   *
   * The point is his top-left, offset by half his width and most of his
   * height, so he ends up standing *on* the tap rather than hanging below and
   * right of it.
   */
  useEffect(() => {
    if (phase !== "awake") return;
    function onTap(event: PointerEvent) {
      const el = event.target as HTMLElement | null;
      if (!el) return;
      if (el.closest("a, button, input, textarea, select, [role='button']"))
        return;
      if (el.closest("[data-exy]")) return;
      if (window.getSelection()?.toString()) return;

      const w = SPRITE_PX * scale.current;
      target.current = {
        x: event.clientX + window.scrollX - w / 2,
        y: event.clientY + window.scrollY - w * 0.8,
      };
      // Retires the hint the same way a keypress does — he's been driven.
      setHasWalked(true);
    }
    window.addEventListener("pointerdown", onTap);
    return () => window.removeEventListener("pointerdown", onTap);
  }, [phase]);

  const sleep = useCallback(() => {
    setPhase("asleep");
    setShaking(false);
    setWalking(false);
    scale.current = 1;
    held.current.clear();
  }, []);

  /*
   * Emerging: he's portalled into the header slot and walked out of it by
   * `exy-emerge`, so nothing here moves him — this only cycles his frames, and
   * then hands him to the free-walking loop at the position the animation left
   * him at.
   *
   * The handoff reads the slot's box rather than assuming: the animation ends
   * flush with its right edge, so the slot *is* where he's standing, in
   * viewport coordinates, which is what the fixed layer wants.
   */
  useEffect(() => {
    if (phase !== "emerging") return;

    const step = window.setInterval(
      () => setFrame((f) => (f % WALK_FRAMES) + 1),
      1000 / WALK_FPS_SIDE,
    );

    const done = window.setTimeout(() => {
      const slot = document.getElementById(EMERGE_ID)?.getBoundingClientRect();
      pos.current = slot
        ? { x: slot.left, y: slot.top }
        : { x: 24, y: window.innerHeight - SPRITE_PX - 24 };
      contain();
      setPhase("awake");
    }, EMERGE_MS);

    return () => {
      window.clearInterval(step);
      window.clearTimeout(done);
    };
  }, [phase, contain]);

  /* Key handling. Only while awake, and never while typing. */
  useEffect(() => {
    if (!awake) return;

    function isTyping(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
      );
    }

    function onDown(event: KeyboardEvent) {
      if (event.key === "Escape") return sleep();
      if (isTyping(event.target)) return;

      const key = event.key.toLowerCase();
      if (!(key in KEY_DIRECTION)) return;
      // Only once the key is a movement key — otherwise this would swallow
      // every shortcut on the page while he's out.
      event.preventDefault();
      held.current.add(key);
      // Retires the hint. Safe to call on every keydown — React bails out of
      // the re-render once the value stops changing.
      setHasWalked(true);
    }

    function onUp(event: KeyboardEvent) {
      held.current.delete(event.key.toLowerCase());
    }

    /*
     * A held key whose keyup lands while the tab is hidden is never released,
     * so he'd walk forever on return. Dropping everything on blur fixes it.
     */
    function onBlur() {
      held.current.clear();
    }

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [awake, sleep]);

  /* The loop. */
  useEffect(() => {
    if (!awake) return;

    function tick(now: number) {
      const dt = lastTick.current ? (now - lastTick.current) / 1000 : 0;
      lastTick.current = now;

      /*
       * Resolve held keys to directions first, rather than testing for "w" and
       * "a" literally. W and ArrowUp are the same instruction, so holding both
       * has to count once — testing keys would have added their contributions
       * and sent him up at double speed.
       */
      // `forEach` rather than `for…of`: this project's TS target predates
      // iterating a Set without `downlevelIteration`.
      const going = new Set<Heading>();
      held.current.forEach((key) => {
        const dir = KEY_DIRECTION[key];
        if (dir) going.add(dir);
      });
      // A key takes over from a tap. See the note where the target is read.
      if (going.size > 0) target.current = null;

      let dx = 0;
      let dy = 0;
      if (going.has("up")) dy -= 1;
      if (going.has("down")) dy += 1;
      if (going.has("left")) dx -= 1;
      if (going.has("right")) dx += 1;

      /*
       * Walking to a tapped point, when no key is doing the steering.
       *
       * Deliberately *after* the keys and only when they're idle, so a
       * keyboard always wins — pressing a key mid-walk takes him over rather
       * than fighting the destination. Touching a key also cancels the target
       * outright, or he'd resume walking to it the moment the key came up.
       *
       * The direction is fed into the same `dx`/`dy` the keys produce, which
       * is the whole reason this is only a few lines: facing, frame rate,
       * scaling and containment all read those and need no idea a tap
       * happened. **Not normalised here** — the code below does it, and
       * normalising twice would be harmless but the raw delta is also what
       * `ARRIVE` is measured against.
       */
      if (dx === 0 && dy === 0 && target.current) {
        const tx = target.current.x - pos.current.x;
        const ty = target.current.y - pos.current.y;
        /*
         * Arrival needs a radius, not equality: he moves in whole frames, so
         * he steps over an exact point and then oscillates around it forever.
         * Scaled by his own size, because a big near Exy covering the last
         * 12px is a smaller part of a stride than a distant one doing the
         * same.
         */
        const ARRIVE = 14 * scale.current;
        if (Math.hypot(tx, ty) <= ARRIVE) {
          target.current = null;
        } else {
          dx = tx;
          dy = ty;
        }
      }

      const moving = dx !== 0 || dy !== 0;

      if (moving) {
        /*
         * Normalise, or holding two keys makes him 41% faster on the diagonal.
         *
         * Speed rides on `scale`, because near things cross your view faster
         * than far ones at the same real speed — without it he'd trudge when
         * close and scurry when distant, which is the depth cue backwards.
         *
         * It also costs nothing: a cycle carries him a fixed fraction of his
         * own body length, and both his body and his speed scale together, so
         * the time per cycle is unchanged. `WALK_FPS_SIDE` stays derived at
         * every size rather than only at 1x.
         */
        const len = Math.hypot(dx, dy);
        pos.current.x += (dx / len) * SPEED_X * scale.current * dt;
        pos.current.y += (dy / len) * SPEED_Y * scale.current * dt;

        /*
         * Down is toward the viewer, so he grows; up is away, so he shrinks.
         *
         * **Only when the vertical key is held on its own.** On a diagonal
         * he's mostly crossing the page rather than closing on you, so
         * resizing there made every stray brush of S or W nudge his size, and
         * it drifted. Requiring the key alone makes the resize deliberate.
         *
         * Before `contain`, which reads the scaled size — otherwise growing
         * against an edge would push him through it.
         */
        if (dy !== 0 && dx === 0) {
          scale.current = Math.min(
            SCALE_MAX,
            Math.max(SCALE_MIN, scale.current + dy * SCALE_RATE * dt),
          );
        }
        contain();

        /*
         * Left/right wins over up/down when both are held: a side-on dog
         * reads as diagonal movement far better than a front-on one does.
         */
        const next: Heading =
          dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
        setHeading((current) => (current === next ? current : next));

        // Front and side run at different rates — see WALK_FPS_SIDE.
        frameClock.current += dt;
        const step = 1 / (next === "down" ? WALK_FPS_FRONT : WALK_FPS_SIDE);
        if (frameClock.current >= step) {
          frameClock.current %= step;
          setFrame((f) => (f % WALK_FRAMES) + 1);
        }
      } else {
        frameClock.current = 0;
      }

      setWalking((was) => (was === moving ? was : moving));

      paint();

      raf.current = requestAnimationFrame(tick);
    }

    // Place him before the first frame runs. Both copies start with no
    // transform, i.e. at 0,0 — without this he flashes in the top-left corner
    // for one frame every time he wakes.
    paint();
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      lastTick.current = 0;
    };
  }, [awake, contain, paint]);

  /* Keep him on screen when the window is resized. */
  useEffect(() => {
    if (!awake) return;
    function onResize() {
      contain();
      paint();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [awake, contain, paint]);

  const cycle = CYCLE[heading];

  /*
   * Standing still, he holds whichever way he was last walking rather than
   * always turning to face you.
   *
   * `sit.png` is a front-on pose, so using it for every stop meant he spun to
   * face the viewer the moment you let go of A or D — which undoes the one
   * thing the side sprite is for. It's still right after W or S, where he
   * genuinely was facing up or down the page.
   *
   * `stand-side.png` is its own frame rather than one of the seven, because
   * none of them is a standing pose — they're a trot, so every one has a leg
   * mid-swing and held still reads as a freeze-frame. This is cut from between
   * two of them, at the moment his legs are most nearly vertical under him.
   *
   * It shares the walk cycle's exact canvas, so stopping doesn't resize him.
   * `cycle.flip` still applies, so stopping while walking left keeps him
   * facing left.
   */
  const sideways = heading === "left" || heading === "right";
  const src = walking
    ? `${ASSETS}/walk-${cycle.name}-${frame}.png`
    : sideways
      ? `${ASSETS}/stand-side.png`
      : `${ASSETS}/sit.png`;

  /*
   * Emerging: parented to the header slot, behind the photo, walked out of it
   * by CSS. Deliberately not the fixed layer — that paints above the avatar,
   * so he'd stroll over Bradley's face instead of out from behind it.
   */
  if (phase === "emerging" && slots?.emerge) {
    return createPortal(
      /* eslint-disable-next-line @next/next/no-img-element -- see below. */
      <img
        src={`${ASSETS}/walk-side-${frame}.png`}
        alt=""
        height={SPRITE_PX}
        className="block animate-exy-emerge"
        style={{ height: SPRITE_PX, width: "auto" }}
      />,
      slots.emerge,
    );
  }

  /*
   * Asleep: he's behind the avatar and only his tail shows.
   *
   * The button wraps just the tail, so the click target is the tail itself.
   * The half tucked behind the photo genuinely isn't clickable — the frame
   * paints over it — which is the behaviour you'd want anyway.
   */
  if (!awake) {
    if (slots === undefined) return null; // not looked for the slots yet

    /*
      `HoverNote` rather than `title`, because the note is wanted after half a
      second and the native tooltip's delay is fixed at about one — the same
      reason this component exists at all, just in the other direction.
      `align="left"` because the den is on the avatar's left edge, so a
      right-aligned note would run back under the photo.

      The label says "(click)" because the tail alone doesn't read as a
      control: it wags on its own, which looks like decoration, and the half of
      him that would explain it is behind the photo.
    */
    const tail = (
      <HoverNote note="Exy (click)" align="left" delay className="block">
        <button
          type="button"
          onClick={wake}
          aria-label="Wake up Exy"
          className="group/tail block cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- see below. */}
          <img
            src={`${ASSETS}/tail.png`}
            alt="Exy's tail, poking out from behind the photo"
            height={TAIL_PX}
            /*
             * The art already points left, so there's no mirror here — moving
             * the den to the avatar's other edge would need `-scale-x-100` and
             * a mirrored `origin-*`.
             *
             * `origin-[92%_83%]` is the tail's base, measured off the asset.
             * It is the whole trick: about the default centre the tail swings
             * like a propeller and drags its cropped root out from behind the
             * photo, showing the straight cut edge. About the base, the root
             * stays hidden and only the tip moves.
             *
             * `motion-safe` on both, so it's still under
             * prefers-reduced-motion — as `scroll-behavior` is on `html`.
             */
            className="origin-[92%_83%] motion-safe:animate-wag motion-safe:group-hover/tail:animate-wag-fast"
            style={{ height: TAIL_PX, width: "auto" }}
          />
        </button>
      </HoverNote>
    );

    if (den) return createPortal(tail, den);

    /* No den on this page — sit in the corner instead. */
    return (
      <button
        type="button"
        onClick={wake}
        aria-label="Wake up Exy"
        title="Exy (click)"
        className="fixed bottom-6 left-6 z-30 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- frames swap
            every ~77ms; routing each through the image optimiser would add a
            request per frame for no benefit on an already-tiny PNG. */}
        <img
          src={`${ASSETS}/sit.png`}
          alt="Exy, sitting"
          height={SPRITE_PX * 0.7}
          style={{ height: SPRITE_PX * 0.7, width: "auto" }}
        />
      </button>
    );
  }

  return (
    <>
      {COPIES.map((i) => (
        <div
          key={i}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          className="pointer-events-none fixed left-0 top-0 z-30 will-change-transform"
          /* Copy 1 exists only to fill in the far edge mid-wrap; it's a
             duplicate of the same dog, so it shouldn't be announced twice. */
          aria-hidden={i > 0}
        >
          {/*
            Carries the scale, written straight to the node by the loop.

            `origin-bottom` is what keeps him standing on the same spot as he
            grows — scaled about its centre he'd sink into the page walking
            toward you and lift off it walking away.
          */}
          <div
            ref={(el) => {
              bodies.current[i] = el;
            }}
            className="pointer-events-auto flex origin-bottom flex-col items-center gap-1"
          >
            {/*
              The shake goes on this wrapper, not on the image. The image
              carries an inline `scaleX(-1)` when he faces left, and a running
              animation's transform beats an inline style in the cascade —
              animating the image itself would flip him round for the length of
              every shake.

              `onAnimationEnd` clears it rather than a timer, so the flag can't
              drift out of step with the animation's real duration, and a
              second click always restarts it. Both copies animate off the one
              flag, so a poke mid-wrap shakes the whole dog rather than half.
            */}
            <div
              /*
                `data-exy` is what the tap-to-walk listener checks to leave him
                alone. Without it a poke would also register as a destination
                and send him to where he already is — he'd shake and then take
                a step, which reads as him flinching away from you.
              */
              data-exy
              onClick={poke}
              onAnimationEnd={() => setShaking(false)}
              className={shaking ? "animate-exy-shake" : undefined}
              style={{ cursor: "pointer" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- see above. */}
              <img
                src={src}
                alt={i === 0 ? "Exy" : ""}
                height={SPRITE_PX}
                style={{
                  height: SPRITE_PX,
                  width: "auto",
                  display: "block",
                  // Mirrored for the left-facing walk — one side cycle covers both.
                  transform: cycle.flip ? "scaleX(-1)" : undefined,
                  // Nearest-neighbour keeps hand-cut frames crisp rather than mushy.
                  imageRendering: "auto",
                }}
              />
            </div>
            {/* Hint on the real copy only, or it would read twice mid-wrap. */}
            {!walking && !hasWalked && i === 0 && (
              <span className="label text-[9px] text-muted/70">
                {coarse ? "TAP" : "WASD"}
              </span>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
