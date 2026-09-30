import Image from "next/image";

import type { SteamPlaytime } from "@/lib/steam";
import { favoriteGame, favoriteGameFallbackHours } from "@/lib/profile-data";

/**
 * Steam's "Favorite Game" slot, holding an actual game.
 *
 * **This replaced Favorite Project**, which held DevEval — already the first
 * row of Experience & Projects, so the panel restated something the page had
 * just said. A favourite game is the thing the slot is for, and it's the one
 * fact here that nothing else on the page carries.
 *
 * ## The numbers
 *
 * Hours come from Steam's Web API — see `lib/steam.ts` for why that needs a
 * key even though the profile is public. The favourite is hand-picked and true
 * whether or not the hours are reachable, so the panel never hides itself —
 * the opposite call from the DevEval block, which is *only* numbers and so has
 * nothing left to show.
 *
 * When the lookup fails it falls back to `favoriteGameFallbackHours`, which is
 * Bradley's own figure rather than a fetched one. **Only the lifetime total
 * falls back.** "past 2 weeks" is live-only on purpose: Steam omits that field
 * when you haven't played, so a hardcoded 0 would go on asserting "hasn't
 * played" with nothing able to correct it. One number he stated beats two
 * where he only stated one.
 *
 * "hours on record" and "past 2 weeks" are Steam's own labels, deliberately —
 * the second is a figure Steam puts in exactly this slot, and renaming it
 * would break the one thing a visitor already knows how to read.
 *
 * They're also the only text here besides the name and the blurb. A "live from
 * Steam" tag in the panel bar and a "Valve · 2023" line under the name were
 * both cut at Bradley's request: the first captioned the numbers with the fact
 * that they're fetched, which the whole site already asserts everywhere, and
 * the second stated who made the game rather than anything about him.
 */
export default function FavoriteGame({
  playtime,
}: {
  /** Null when STEAM_API_KEY is unset or the lookup failed. */
  playtime: SteamPlaytime | null;
}) {
  const { name, blurb, url } = favoriteGame;

  /*
   * Live figures when Steam answered, otherwise the hand-set total on its own.
   * Built here rather than inline so the stat row below renders one shape.
   */
  const stats = playtime
    ? [
        { value: playtime.total, label: "hours on record" },
        { value: playtime.past2Weeks, label: "past 2 weeks" },
      ]
    : [{ value: favoriteGameFallbackHours, label: "hours on record" }];

  return (
    <section aria-labelledby="favorite-game-heading" className="panel">
      <div className="panel-bar">
        <h2 id="favorite-game-heading" className="panel-bar-title">
          Favorite Game
        </h2>
      </div>

      <div className="flex gap-4 p-5">
        {/*
          Valve's CS2 mark, supplied by Bradley — the second Steam-owned asset
          on the site after the Years of Service badges, and the same call: he
          asked for it directly, against the carve-out that otherwise generates
          every tile from the palette. It's the game's logo, not a store
          capsule, so the "no capsule art" half of that rule still holds.

          Sourced at 256px for a 84px slot, past 2x on any display. Its gold
          (240,176,66) lands within a few points of `accent` (#de9b35), so no
          frame is needed to tie it to the page — a border here just fought
          the artwork. `shrink-0` so it can't be squeezed when the name wraps.
        */}
        {/*
          The logo links too, and is hidden from assistive tech rather than
          given its own label. It points at the same place as the name right
          beside it, so a second announced link would just be the same
          destination read twice — `aria-hidden` plus `tabIndex={-1}` keeps it
          out of the tab order and out of the accessibility tree while leaving
          it clickable, which is what a duplicated image link should do.
        */}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-hidden
          tabIndex={-1}
          className="shrink-0"
        >
          <Image
            src="/cs2-logo.png"
            alt=""
            width={84}
            height={84}
            className="h-[84px] w-[84px] rounded-[2px] transition-opacity hover:opacity-90"
          />
        </a>

        <div className="min-w-0 flex-1">
          <h3 className="text-[19px] font-light leading-tight">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="steam-link text-bright"
            >
              {name}
            </a>
          </h3>

          <p className="t-body mt-1.5">{blurb}</p>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-1">
            {stats.map(({ value, label }) => (
              <span key={label} className="flex items-baseline gap-2">
                {/*
                  `toLocaleString` for the thousands separator, and tabular
                  figures so the pair doesn't shift when the numbers change.
                */}
                <span className="text-[24px] font-light leading-none tabular-nums text-ink">
                  {value.toLocaleString()}
                </span>
                <span className="t-meta">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
