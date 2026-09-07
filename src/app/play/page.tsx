import type { Metadata } from "next";
import dynamic from "next/dynamic";

import SiteNav from "@/components/SiteNav";
import { getGitHubSnapshot } from "@/lib/github";
import { githubUsername, profile } from "@/lib/profile-data";

/**
 * `/play` — deliberately empty for now.
 *
 * It exists so the nav's Play item can be a real link instead of a dim
 * placeholder. Everything but the message is borrowed from the profile page,
 * so it reads as the same site rather than a stub someone forgot: the same
 * nav, the same centred `max-w-profile` column on the black surround, the same
 * panel and panel-bar, and the same footer disclaimer.
 *
 * The snapshot is fetched for one reason — `SiteNav` hides its whole right-hand
 * block when `stats` is null, so without it the nav here would be visibly
 * shorter than the nav on the profile page. Same ISR window, so it's the same
 * cached response rather than a second round of calls.
 */
/** Literal, not the imported constant — Next requires this statically
 *  analyzable, and it matches the profile page's window. */
export const revalidate = 300;

/*
 * Loaded on demand, and `ssr: false` is the point rather than a detail.
 *
 * three.js is ~170 KB gzipped — larger than this entire site's JS. A static
 * import would put it in the shared bundle and charge `/` and `/about` for a
 * thing only this page renders. `dynamic` keeps it in its own chunk, fetched
 * when this route is.
 *
 * `ssr: false` because there is no WebGL on a server: `<Canvas>` reaches for
 * one on mount, so rendering it server-side throws.
 *
 * The `loading` state is not decoration either. The reference site this
 * prototype came from mounts its canvas unconditionally, and on any browser
 * without WebGL — blocked, locked down, headless — half its hero is simply
 * blank. Verified: I could not see its model until I re-ran Chrome with
 * software rendering. Something has to occupy the space.
 */
const BtMark3D = dynamic(() => import("@/components/BtMark3D"), {
  ssr: false,
  loading: () => <p className="t-meta">Loading…</p>,
});

export const metadata: Metadata = {
  title: `Play — ${profile.name}`,
  alternates: { canonical: "/play" },
};

export default async function Play() {
  const snapshot = await getGitHubSnapshot(githubUsername);

  return (
    <>
      <SiteNav stats={snapshot.stats} />

      <main className="mx-auto w-full max-w-profile bg-hero px-3 pb-6 pt-3 sm:px-4 sm:pb-8 sm:pt-4">
        <section aria-labelledby="play-heading" className="panel">
          <div className="panel-bar">
            <h1 id="play-heading" className="panel-bar-title">
              Play
            </h1>
          </div>

          {/*
            `min-h` rather than a fixed height: the page has one line on it, and
            a panel sized to that line reads as a strip rather than as a page.
            This gives it room without pinning it to a number that would need
            revisiting the moment anything lands here.
          */}
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-10">
            {/*
              The mark, extruded and spinning — a prototype, and the reason
              this page has anything on it at all. Hovering stops it.

              Sized in `vh` with a cap so it scales with the viewport rather
              than being pinned to a number, and a fixed aspect so the canvas
              never collapses while its chunk is still loading.
            */}
            <BtMark3D className="h-[46vh] max-h-[420px] w-full" />

            {/*
              `font-sign`, the same face and treatment `BoardedUp` uses for the
              privacy cover. The site already has a way of saying "coming
              soon"; saying it a second way in body copy would read as a
              different site's placeholder.
            */}
            <p className="font-sign mt-2 text-[32px] leading-none tracking-[-0.01em] text-bright sm:text-[40px]">
              Coming soon
            </p>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted/70">
          <span>
            Layout inspired by Steam profiles. Not affiliated with Valve.
          </span>
        </footer>
      </main>
    </>
  );
}
