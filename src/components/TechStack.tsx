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
 * Accent gold for a found chip. It's the site's one "you earned this" colour
 * — the award chip in Experience is the same — where `link` blue means "under
 * your pointer" and `live` green means "this number is being fetched". Both
 * of those would have said something untrue about a lit chip.
 */
const CHIP_FOUND = "border-accent/60 bg-accent/10 text-accent";

export default function TechStack({ items }: { items: string[] }) {
  const { unlocked, unlock } = usePlayMode();
  const [found, setFound] = useState<ReadonlySet<string>>(() => new Set());
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);
  const list = useRef<HTMLUListElement>(null);

  const collect = useCallback((tech: string) => {
    setFound((was) => {
      if (was.has(tech)) return was;
      const next = new Set(was);
      next.add(tech);
      return next;
    });
  }, []);

  /*
   * The unlock is an effect rather than part of the updater above, because a
   * state updater has to be pure — React calls it twice in development, which
   * would fire the noise twice and leave two bursts on screen.
   */
  useEffect(() => {
    if (unlocked || items.length === 0 || found.size < items.length) return;

    unlock();
    playPop();

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
  }, [found.size, items.length, unlocked, unlock]);

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
