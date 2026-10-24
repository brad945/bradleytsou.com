"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import Confetti from "@/components/Confetti";
import { usePlayMode } from "@/components/PlayMode";
import { playPop } from "@/lib/celebrate";

/**
 * The Tech Stack chips, and the easter egg hidden in them.
 *
 * Point at a chip and it stays lit. Light every one of them and play mode
 * unlocks: confetti, a noise, and a button through to `/play`, which is
 * locked until then. Bradley asked for exactly this, including that it reset
 * on refresh — see `PlayMode.tsx` for where the one bit lives and why that
 * gives him the reset for free.
 *
 * ## Three details that decide whether it works
 *
 * **`onPointerEnter`, not `onMouseEnter`.** A tap fires `pointerenter` on
 * touch, so the egg is finishable on a phone. With mouse events it would be
 * a desktop-only door in front of a page, and `/play` would be unreachable
 * for anyone on a touch screen — which is a worse bug than a missing easter
 * egg.
 *
 * **The chips are solids**, so the highlight needs `.solid-tinted`: a
 * `transition-colors` utility here would replace the solid system's
 * `transition-property: transform` outright and the chip would snap to its
 * lifted position while its walls grew behind it. That trap is written up in
 * globals.css; this is the second thing to hit it.
 *
 * **The count comes from the data.** `items.length` is 36 today, and
 * `techStack` is derived from the tags on roles and projects — so adding a
 * tag anywhere on the site makes the egg one chip longer, by itself.
 *
 * ## The window, and the unwind
 *
 * All 36 have to be lit inside `WINDOW_MS`, at Bradley's request, or the run
 * ends. The clock starts on the first chip, not on load, so it can't be
 * running before anyone has noticed the egg exists.
 *
 * **Running out doesn't drop them all at once.** They go out one at a time,
 * each at the same offset into the unwind that it was lit at into the run —
 * "fade back to normal in the same time pattern it was hovered over", which
 * means the lights go off in the order they came on and the unwind takes
 * exactly as long as the sweep did. `litAt` holds the timestamps that makes
 * that possible, and it's a ref rather than state because nothing renders
 * from it directly.
 *
 * Pointing at a chip mid-unwind cancels the rest of it and starts a clean
 * run, rather than letting a new sweep race the old one's timers out.
 *
 * There's no countdown drawn anywhere. The chips going out *is* the feedback
 * — the one thing you'd want a timer to tell you is that you ran out — and a
 * progress bar would be the decorative meter this site took two of out.
 *
 * The window's own timeout lives in a ref too, and the effect that arms it
 * returns early when one is already ticking. That matters: the effect has to
 * re-run as chips land, so re-arming on every render would hand you the full
 * window *per chip* instead of one window for the run.
 *
 * It isn't keyboard-reachable, and that's the honest cost of "hover over the
 * tech stack elements": the chips are `<li>`s and making 36 of them tab stops
 * would wreck the page's keyboard order to hide a joke behind it. The thing
 * it gates is a page that currently says "Coming soon".
 */

/*
 * Written out in full, both of them, because Tailwind's scanner reads source
 * as text — it can see these two literals and could not see
 * `border-${state}`. Switching between two whole strings is the spelling that
 * survives that.
 */
const CHIP =
  "solid solid-thin solid-edged solid-tinted border px-2 py-1 text-[12px] leading-none";
const CHIP_REST = "border-line/70 bg-panel2/60 text-copy";
/*
 * Link blue for a found chip, at Bradley's request — it was accent gold and
 * he asked for "a slightly lighter blue instead of the orange". `link`
 * (#66c0f4) is the palette's light blue and the only one, so this is that
 * rather than a new token for one state.
 *
 * It does overload the site's own meaning of blue, which is "under your
 * pointer" — but a lit chip *was* under your pointer a moment ago, so the
 * two readings don't actually fight.
 */
const CHIP_FOUND = "border-link/60 bg-link/10 text-link";

/** How long a run lasts. All 36 inside it or the chips go out. */
const WINDOW_MS = 2500;

export default function TechStack({ items }: { items: string[] }) {
  const { unlocked, unlock } = usePlayMode();
  const [found, setFound] = useState<ReadonlySet<string>>(() => new Set());
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);
  const list = useRef<HTMLUListElement>(null);
  /** The live window timeout, or 0. */
  const expiry = useRef(0);
  /** When each chip was lit, which is what the unwind replays. */
  const litAt = useRef(new Map<string, number>());
  /** The unwind's own timeouts, one per chip. */
  const fading = useRef<number[]>([]);

  const stopFade = useCallback(() => {
    fading.current.forEach(window.clearTimeout);
    fading.current = [];
  }, []);

  /*
   * The guard and the timestamp are both up here in the handler rather than
   * inside the updater, which has to stay pure — React calls an updater twice
   * in development, and a `performance.now()` in one would record two
   * different times for the same chip.
   */
  const collect = useCallback(
    (tech: string) => {
      /* Pointing at a chip part-way through an unwind starts a clean run
         rather than racing a new sweep against the old one's timers. */
      if (fading.current.length) {
        stopFade();
        litAt.current.clear();
        litAt.current.set(tech, performance.now());
        setFound(new Set([tech]));
        return;
      }

      if (litAt.current.has(tech)) return;
      litAt.current.set(tech, performance.now());
      setFound((was) => new Set(was).add(tech));
    },
    [stopFade],
  );

  /*
   * Arm the window on the first chip of a run; disarm it when the run ends,
   * either way. `expiry.current` is the live timeout id, and the early return
   * on it is what makes this three seconds for the run rather than three
   * seconds per chip — the effect re-runs as each chip lands.
   */
  useEffect(() => {
    if (unlocked) return;

    if (found.size === 0 || found.size >= items.length) {
      window.clearTimeout(expiry.current);
      expiry.current = 0;
      return;
    }

    if (expiry.current) return;
    expiry.current = window.setTimeout(() => {
      expiry.current = 0;

      /*
       * Out in the order they came on, each at the same offset into the
       * unwind as it had into the run — so the sweep plays backwards at its
       * own pace. Each chip's own 180ms colour transition does the fading;
       * this only decides when.
       */
      /* `Array.from`, not a spread: the project targets ES5, where spreading
         a Map iterator needs `--downlevelIteration`. */
      const lit = Array.from(litAt.current.entries()).sort(
        (a, b) => a[1] - b[1],
      );
      const first = lit.length > 0 ? lit[0][1] : 0;
      for (const [tech, at] of lit) {
        fading.current.push(
          window.setTimeout(() => {
            litAt.current.delete(tech);
            setFound((was) => {
              const next = new Set(was);
              next.delete(tech);
              return next;
            });
            if (litAt.current.size === 0) fading.current = [];
          }, at - first),
        );
      }
    }, WINDOW_MS);
  }, [found, items.length, unlocked]);

  /* Unmounting mid-run must not leave a timeout holding a dead setState. */
  useEffect(
    () => () => {
      window.clearTimeout(expiry.current);
      fading.current.forEach(window.clearTimeout);
    },
    [],
  );

  /*
   * The unlock is an effect rather than part of the updater above, because a
   * state updater has to be pure — React calls it twice in development, which
   * would fire the noise twice and leave two bursts on screen.
   */
  useEffect(() => {
    if (unlocked || items.length === 0 || found.size < items.length) return;

    unlock();
    playPop();
    stopFade();

    /*
     * No confetti under `prefers-reduced-motion`, the same call `Reactions`
     * makes about its flying emoji: the pieces simply never spawn. The sound
     * and the button still land, so the egg is still finishable and still
     * tells you so — what's withheld is sixty things flying across the
     * screen, which is the part someone asking for reduced motion is asking
     * not to have.
     */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const box = list.current?.getBoundingClientRect();
    if (box) setBurst({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }, [found.size, items.length, unlocked, unlock, stopFade]);

  const clearBurst = useCallback(() => setBurst(null), []);

  return (
    <>
      {/*
        Chips rather than the mono dot-list the same tags use in Experience.
        There they're a footnote under a role and shouldn't compete with it;
        here they're the content of the panel.
      */}
      <ul ref={list} className="mt-3 flex flex-wrap gap-1.5">
        {items.map((tech) => (
          <li
            key={tech}
            onPointerEnter={() => collect(tech)}
            className={`${CHIP} ${found.has(tech) ? CHIP_FOUND : CHIP_REST}`}
          >
            {tech}
          </li>
        ))}
      </ul>

      {/*
        `next/link`, and that is the whole feature: a plain anchor would
        reload the document, tear down the provider holding the unlock and
        land on the locked page it was offering to open.
      */}
      {unlocked && (
        <Link href="/play" className="steam-button mt-3 w-full">
          Play mode unlocked
        </Link>
      )}

      {burst && <Confetti x={burst.x} y={burst.y} onDone={clearBurst} />}
    </>
  );
}
