/**
 * Live stats from DevEval's own API. (The product was called CodeArena until
 * mid-2026, and the repo has since been renamed to match.)
 *
 * The rest of this site proves "every number is fetched, not written" using
 * someone else's API. This block does it with Bradley's own product, which is
 * the part that actually says something about him.
 *
 * Configured by `DEVEVAL_STATS_URL`. With no endpoint set — or if the
 * endpoint is down, slow, or returns something unexpected — this returns null
 * and the sidebar block hides itself. It never invents a number and never
 * throws.
 *
 * The endpoint should return JSON with any subset of these keys:
 *
 *   { "submissions": 1204, "matches": 318, "players": 96, "problems": 42 }
 *
 * Unknown keys are ignored, and non-finite values are dropped, so a malformed
 * or partially-migrated response degrades to fewer rows rather than rendering
 * "NaN" on the page.
 */

import { REVALIDATE_SECONDS } from "@/lib/github";

export interface DevEvalStats {
  submissions?: number;
  matches?: number;
  players?: number;
  problems?: number;
}

/** Render order and labels. Rows whose value is missing are skipped. */
export const DEVEVAL_ROWS: { key: keyof DevEvalStats; label: string }[] = [
  { key: "submissions", label: "Submissions Judged" },
  { key: "matches", label: "Matches Played" },
  { key: "players", label: "Players" },
  { key: "problems", label: "Problems" },
];

/** Accepts only finite numbers, so junk in the payload can't reach the UI. */
function readCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

export async function getDevEvalStats(): Promise<DevEvalStats | null> {
  const url = process.env.DEVEVAL_STATS_URL;
  if (!url) return null;

  let payload: unknown;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    payload = await res.json();
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;

  const stats: DevEvalStats = {
    submissions: readCount(raw.submissions),
    matches: readCount(raw.matches),
    players: readCount(raw.players),
    problems: readCount(raw.problems),
  };

  // Nothing usable came back — treat it as "no data" rather than an empty box.
  const hasAny = DEVEVAL_ROWS.some(({ key }) => stats[key] !== undefined);
  return hasAny ? stats : null;
}
