import ActivityFeed from "@/components/ActivityFeed";
import AutoRefresh from "@/components/AutoRefresh";
import BoardedUp from "@/components/BoardedUp";
import Experience from "@/components/Experience";
import FavoriteGame from "@/components/FavoriteGame";
import ProfileHeader from "@/components/ProfileHeader";
import SiteNav from "@/components/SiteNav";
import Sidebar from "@/components/Sidebar";
import Comments from "@/components/Comments";

// Parked, and swapped for Comments. Everything works — the route, the store,
// the flying emoji — it's just not what's wanted on the page right now.
// Uncomment this and the tag below to bring it back; the Upstash env vars are
// still what decides whether it renders at all.
// import Reactions from "@/components/Reactions";

import Exy from "@/components/Exy";

import { getDevEvalStats } from "@/lib/deveval";
import { getSteamPlaytime } from "@/lib/steam";
import { getRecentTracks } from "@/lib/spotify";
import {
  getContributions,
  getGitHubSnapshot,
  getFeaturedRepos,
  getLanguages,
  getLastPush,
  getDiscussionComments,
} from "@/lib/github";
import {
  githubUsername,
  featuredRepos,
  privacyScreen,
  giscus,
  siteRepoSlug,
  favoriteGame,
  steamId64,
} from "@/lib/profile-data";

/**
 * ISR window for the whole page.
 *
 * 60, down from 300, because two 300s windows stack: a fetch result can
 * already be five minutes old when the page rebuilds, and the HTML is then
 * served for another five. Measured against Spotify directly, that put a track
 * on the page roughly ten minutes after it played — and worse, the "9m ago"
 * beside it was computed at render, so the label understated the gap by
 * exactly the amount the page was stale. It read fresher than it was.
 *
 * The GitHub fetches keep their own 300 (`REVALIDATE_SECONDS`), so rebuilding
 * more often costs nothing there — a push is not time-sensitive the way a song
 * is. Only Spotify's fetches came down with this.
 */
export const revalidate = 60;

export default async function Home() {
  const [owner, repo] = siteRepoSlug.split("/");
  const [
    snapshot,
    deveval,
    contributions,
    featured,
    languages,
    lastPush,
    commentCount,
    playtime,
    tracks,
  ] = await Promise.all([
    getGitHubSnapshot(githubUsername),
    getDevEvalStats(),
    getContributions(githubUsername),
    getFeaturedRepos(featuredRepos),
    getLanguages(),
    getLastPush(),
    // The comments panel is a real GitHub Discussion, so the sidebar's
    // Comments row can finally be a number instead of an em-dash.
    getDiscussionComments(owner, repo, giscus.discussion),
    getSteamPlaytime(steamId64, favoriteGame.appId),
    getRecentTracks(),
  ]);

  return (
    <>
      <SiteNav stats={snapshot.stats} />

      {/*
        Top padding is deliberately smaller than the bottom: `pt-3` against
        `pb-6`/`pb-8`. The nav is its own dark bar, so the column's top padding
        was stacking on the visual break the bar already makes and pushing the
        avatar down away from it. The bottom keeps the larger value — there's
        nothing under the column to break against.
      */}
      <main className="mx-auto w-full max-w-profile bg-hero px-3 pb-6 pt-3 sm:px-4 sm:pb-8 sm:pt-4">
        <ProfileHeader stats={snapshot.stats} />

        {/*
          Steam's main/sidebar split, restored. It was flattened to a single
          column and that was the wrong reading — what Bradley wanted contained
          in one column is the *page*, which the centred `max-w-profile` block
          above already does. The two columns live inside it.

          ~649 / 12 / ~325 at ≥lg; stacks below that. The gap is 12px, Steam's
          own `.profile_customization` margin, not the 16 it used to be.
        */}
        {/*
          The cover renders *instead of* the grid, not over it — see the note
          on `privacyScreen`. The grid below is untouched; flipping the flag
          brings it back exactly as it is.
        */}
        {privacyScreen ? (
          <BoardedUp />
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-[2fr_1fr]">
            <div className="flex min-w-0 flex-col gap-3">
              {/*
              Order: Activity, Experience, Favorite Project. Activity leads
              because what he's working on now reads before where he's been,
              and Favorite Project sits last as the closing note rather than
              the opening one.
            */}
              <ActivityFeed
                snapshot={snapshot}
                featured={featured}
                tracks={tracks}
              />
              <Experience featured={featured} />
              <FavoriteGame playtime={playtime} />
              {/* The panel a visitor contributes to, last in the column so it
                  reads as the end of the page rather than an interruption in
                  it. Reactions is parked above; this is the swap. */}
              {/* <Reactions /> */}
              <Comments />
            </div>

            <Sidebar
              snapshot={snapshot}
              deveval={deveval}
              contributions={contributions}
              languages={languages}
              lastPush={lastPush}
              commentCount={commentCount}
            />
          </div>
        )}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted/70">
          <span>
            Layout inspired by Steam profiles. Not affiliated with Valve.
          </span>
        </footer>

        {/*
          Matches the page's own ISR window, not GitHub's — this is what makes
          a tab left open actually pick the new page up, so it has to fire as
          often as the page can change.
        */}
        <AutoRefresh intervalSeconds={revalidate} />

        {/* Sits outside the column on purpose — he walks the whole viewport,
            not just the centred block. */}
        <Exy />
      </main>
    </>
  );
}
