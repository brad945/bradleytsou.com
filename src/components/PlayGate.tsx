"use client";

import { usePlayMode } from "@/components/PlayMode";

/**
 * The lock on `/play`.
 *
 * Renders the page's contents once the Tech Stack easter egg is finished and
 * a line saying so until then — see `TechStack.tsx` for the egg and
 * `PlayMode.tsx` for where the bit lives.
 *
 * **The children are only ever mounted unlocked**, which matters more than it
 * looks: the model behind this gate is a `dynamic()` import of three.js, and
 * `dynamic` fetches its chunk on mount. A locked visitor never mounts it, so
 * they never download it either — the lock costs nothing and saves 170 kB.
 *
 * No hint about where the egg is. "Hidden" was the word in the request, and a
 * locked door that tells you which wall the key is behind isn't one.
 */
export default function PlayGate({ children }: { children: React.ReactNode }) {
  const { unlocked } = usePlayMode();

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      {/*
        `font-sign`, the face this site uses for a thing that isn't open yet —
        the same treatment as the "Coming soon" line below the model and the
        privacy cover in `BoardedUp`. A third way of saying it would read as a
        different site's placeholder.
      */}
      <p className="font-sign text-[40px] leading-none tracking-[-0.01em] text-bright sm:text-[52px]">
        Locked
      </p>
      <p className="t-meta">Complete the hidden easter egg first.</p>
    </div>
  );
}
