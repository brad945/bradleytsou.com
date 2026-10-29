import type { Metadata } from "next";
import dynamic from "next/dynamic";

import CanvasBoundary from "@/components/CanvasBoundary";
import PlayGate from "@/components/PlayGate";
import SiteNav from "@/components/SiteNav";
import { getGitHubSnapshot } from "@/lib/github";
import { githubUsername, profile, tabName } from "@/lib/profile-data";
import { openGraphFor } from "@/lib/seo";

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
const Model3D = dynamic(() => import("@/components/Model3D"), {
  ssr: false,
  loading: () => <p className="t-meta">Loading…</p>,
});

export const metadata: Metadata = {
  title: `Play — ${tabName}`,
  alternates: { canonical: "/play" },
  /* No `description` of its own: there's nothing on this page to describe
     yet, and the root's tagline is at least true of the site. The Open Graph
     block still has to be built, or the inherited `url` names the homepage —
     see `openGraphFor`. */
  openGraph: openGraphFor("/play"),
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
          {/*
            Locked until the Tech Stack easter egg on `/` is finished, at
            Bradley's request. `PlayGate` renders a line saying so until then,
            and because `Model3D` is a child of it rather than beside it, a
            locked visitor never mounts the canvas and so never downloads
            three.js either. See `PlayMode.tsx` for why a reload re-locks it.
          */}
          <PlayGate>
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-10">
              {/*
                A prototype, and the reason this page has anything on it at
                all. Drag to rotate it.

                No `src`, so it spins the extruded `bt.` mark and downloads no
                model. Pass `src="/models/thing.glb"` to swap in a real one —
                everything else about the scene is already what the reference
                site runs.

                Sized in `vh` with a cap so it scales with the viewport rather
                than being pinned to a number, and a fixed aspect so the canvas
                never collapses while its chunk is still loading.
              */}
              {/*
                This carried `solid-stop` so the panel behind it stayed flat
                while the model was being dragged. Lifts nest now (note 2 in
                globals.css), so the panel rises once as the pointer arrives and
                holds for the whole drag — which is what the class was there to
                get, by the opposite route.
              */}
              {/*
                The boundary is not decoration: `/play` is only reachable by a
                client navigation now, so a WebGL failure here propagates past
                the route and blanks the whole tab. See `CanvasBoundary.tsx`.
              */}
              <CanvasBoundary>
                <Model3D className="h-[46vh] max-h-[420px] w-full" />
              </CanvasBoundary>

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
          </PlayGate>
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
