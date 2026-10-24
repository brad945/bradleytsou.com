"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Whether play mode has been unlocked, for this page view and no longer.
 *
 * `/play` is locked until the Tech Stack easter egg is finished — see
 * `TechStack.tsx` for the egg and `PlayGate.tsx` for the lock. This holds the
 * one bit between them.
 *
 * **It is deliberately nothing but React state**, at Bradley's request: "have
 * it be client sided so refresh restarts it, no need to save it per user or
 * anything like that." That rules out the two obvious stores. `localStorage`
 * would make it permanent, and `sessionStorage` survives a reload, which is
 * exactly the thing he asked it not to do.
 *
 * Which leaves one question — how does a *different route* see it? The
 * provider is mounted in the root layout, and the App Router does not remount
 * a shared layout when only the page segment changes. So unlocking on `/` and
 * following a `next/link` to `/play` arrives with the bit intact, while a
 * reload, a typed URL or any plain `<a>` tears the whole tree down and starts
 * over locked. The behaviour he described falls out of where the state lives
 * rather than out of code that implements it.
 *
 * The one thing that follows from that: **every link into `/play` has to be a
 * `next/link`**, or it reloads the document and drops the unlock. That's why
 * the nav's Play item is one.
 */
const PlayModeContext = createContext<{
  unlocked: boolean;
  unlock: () => void;
}>({
  /*
   * Locked, and no-op, for anything rendered outside the provider. A gate
   * with no provider above it should fail closed rather than throw: the lock
   * is a bit of fun, and a missing provider shouldn't be able to white-screen
   * the route it's guarding.
   */
  unlocked: false,
  unlock: () => {},
});

export function PlayModeProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const unlock = useCallback(() => setUnlocked(true), []);
  const value = useMemo(() => ({ unlocked, unlock }), [unlocked, unlock]);

  return (
    <PlayModeContext.Provider value={value}>
      {children}
    </PlayModeContext.Provider>
  );
}

export function usePlayMode() {
  return useContext(PlayModeContext);
}
