import type { FeaturedRepo, GitHubSnapshot, RepoCard } from "@/lib/github";
import { repoDisplayNames } from "@/lib/profile-data";
import Bookshelf from "@/components/Bookshelf";
import { BookIcon, GitHubIcon, SpotifyIcon } from "@/components/SocialIcons";
import type { Track } from "@/lib/spotify";

interface ActivityFeedProps {
  snapshot: GitHubSnapshot;
  /** Hand-picked repos. Empty without a token — falls back to the public list. */
  featured: FeaturedRepo[];
  /** Repos pushed to most recently, newest first. The GitHub block's source. */
  recent: FeaturedRepo[];
  /** Recently played. Empty when Spotify isn't configured; the block hides. */
  tracks: Track[];
}

function relativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

/** "Jul 24" — matches Steam's "last played on" format. */
function shortDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One activity source inside the panel.
 *
 * Recent Activity used to *be* GitHub — the panel's contents were repo rows
 * and nothing said so. It's becoming a feed of several sources, so each one is
 * now labelled and boxed, and GitHub is one of them rather than the whole
 * thing.
 *
 * A `live` dot marked fetched sources apart from hand-kept ones and was
 * removed at Bradley's request. The distinction still matters when the other
 * sources land — it's stated in `PlannedSources` instead, in words.
 */
function SourceBlock({
  name,
  icon,
  note,
  className,
  rule = false,
  children,
}: {
  name: string;
  icon?: React.ReactNode;
  /**
   * A qualifier beside the source name.
   *
   * Exists for exactly one case: **Books is the only source here that isn't
   * fetched.** GitHub and Spotify are live, and an unlabelled third block
   * sitting between them would inherit their credibility without earning it.
   * Goodreads closed their API in 2020 and nothing replaced it, so that list
   * can only ever be written — and this is where it says so.
   */
  note?: string;
  /** Vertical padding, so each block sits off its dividing rules. */
  className?: string;
  /**
   * Draws the rule above this block.
   *
   * Omitted on GitHub, which is first: a rule directly under the panel bar
   * has nothing above it to divide from. It was briefly added there for
   * symmetry, back when the rules lit up on hover and being the one source
   * that didn't react was worse than a redundant line. The hover is gone, so
   * that reason went with it.
   */
  rule?: boolean;
  children: React.ReactNode;
}) {
  return (
    /*
      Each block owns the rule ABOVE it rather than the container drawing all
      of them with `divide-y`, which puts the border on the sibling.

      That started as a way to let a rule light up with its own block. The
      hover is gone at Bradley's request — an obvious constant line, nothing
      that reacts — but the arrangement stays, because it's also what lets each
      rule fade out at its ends instead of running the full width of the panel.
    */
    <div className={`relative ${className ?? ""}`}>
      {rule && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-muted to-transparent"
        />
      )}
      <div className="mb-2 flex items-baseline gap-2">
        <span className="flex items-center gap-2">
          {icon}
          <span className="t-label text-copy">{name}</span>
        </span>
        {note && <span className="t-meta text-[12px]">{note}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * A single Spotify row: track on the left, artist and when on the right.
 *
 * Same shape as the repo rows above it deliberately — two sources reading the
 * same way is what makes this a feed rather than two widgets in a box.
 */
function TrackRow({ track, now }: { track: Track; now: number }) {
  return (
    /* The hairline is on the `li` and the box is the `div`, which stands 8px
       wider than it on each side — see the row inset in globals.css. */
    <li className="border-t border-line/40 first:border-t-0">
      <div className="solid-hover flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
        <a
          href={track.url}
          target="_blank"
          rel="noreferrer"
          className="steam-link text-[15px] leading-tight"
        >
          {track.title}
        </a>
        <span className="t-meta leading-tight">
          {[track.artist, `${relativeTime(track.playedAt, now)} ago`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
    </li>
  );
}

/**
 * How many repos the GitHub block lists.
 *
 * Exported because the page asks `getRecentRepos` for exactly this many, so
 * the fetch and the render can't disagree about how long the list is.
 *
 * It's also the slice for the two fallback paths, which are longer lists kept
 * for other reasons — `featuredRepos` drives the `ghRepo` lookups behind the
 * Experience and Portfolio rows, so trimming it there would pull data off the
 * page in other places instead of shortening one panel.
 */
export const MAX_ROWS = 3;

/**
 * A featured repo in Steam's "recently played" slot.
 *
 * **Every commit count is gone**, at Bradley's request: the per-row total, the
 * "commits past 2 weeks" strip, and the panel-bar sum that was the analogue of
 * Steam's hours-past-2-weeks. A row is now the repo, its language, when it was
 * last pushed, and its description.
 *
 * `myCommits` and `myCommitsPast2Weeks` are still fetched and still on
 * `FeaturedRepo` — nothing was removed from the data layer, so putting any of
 * it back is a render change only.
 *
 * Private repos aren't linked — a visitor gets a 404.
 */
function FeaturedRepoRow({ repo, now }: { repo: FeaturedRepo; now: number }) {
  const label = repoDisplayNames[repo.nameWithOwner] ?? repo.name;

  /*
   * The product's own site wins over the repo.
   *
   * DevEval's repo is private, so this row was plain text with a Private tag —
   * even though deveval.com exists and is what a reader actually wants. GitHub
   * already holds that URL in the repo's Website field, so it's fetched rather
   * than kept in a second list here.
   *
   * A public repo with no site still links to the repo, as before.
   */
  const href = repo.homepage ?? (repo.isPrivate ? undefined : repo.url);

  const title = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="steam-link text-[15px] leading-tight"
    >
      {label}
    </a>
  ) : (
    <span className="text-[15px] leading-tight text-copy">{label}</span>
  );

  return (
    /* The hairline is on the `li` and the box is the `div`, which stands 8px
       wider than it on each side — see the row inset in globals.css. */
    <li className="border-t border-line/40 first:border-t-0">
      <div className="solid-hover flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
        <span className="flex flex-wrap items-baseline gap-2">
          {title}
          {/*
            Marks a row with nothing to open, which is not the same as a private
            repo — DevEval's repo is private but its site isn't, so that row is a
            link and carries no tag.
          */}
          {!href && (
            <span className="solid solid-thin solid-edged border border-line px-1.5 py-px text-[10px] uppercase tracking-wider text-muted">
              Private
            </span>
          )}
        </span>
        <span className="t-meta leading-tight">
          {[repo.language, `${relativeTime(repo.pushedAt, now)} ago`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
    </li>
  );
}

function PublicRepoRow({ repo, now }: { repo: RepoCard; now: number }) {
  return (
    /* The hairline is on the `li` and the box is the `div`, which stands 8px
       wider than it on each side — see the row inset in globals.css. */
    <li className="border-t border-line/40 first:border-t-0">
      <div className="solid-hover flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          className="steam-link text-[15px] leading-tight"
        >
          {repo.name}
        </a>
        <span className="t-meta leading-tight">
          {[repo.language, `${relativeTime(repo.pushedAt, now)} ago`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
    </li>
  );
}

export default function ActivityFeed({
  snapshot,
  featured,
  recent,
  tracks,
}: ActivityFeedProps) {
  const { repos, fetchedAt } = snapshot;
  const now = Date.parse(fetchedAt);
  /*
   * What the panel is named after, finally: the repos he pushed to most
   * recently, whatever they are — see `getRecentRepos`.
   *
   * It was a hand-picked list, and the cost was that the panel went stale
   * silently while every timestamp on it stayed correct. Sorting by push date
   * fixed the order and couldn't fix that: a repo off the list can't appear at
   * all, so the newest row was routinely older than the work being done that
   * day. Curation still decides the Experience and Portfolio rows, where a
   * `ghRepo` has to resolve to something; it no longer decides this.
   *
   * `featured` is the fallback, and the public list behind it the next one, so
   * a GraphQL failure or a missing token degrades a step at a time rather than
   * emptying the panel.
   */
  const source = recent.length > 0 ? recent : featured;
  const useFeatured = source.length > 0;

  /*
   * Newest push first.
   *
   * `getRecentRepos` already returns this order, so for the normal path this
   * is a no-op — it's here for the curated fallback, which is authored in
   * Bradley's own order, and so that neither source can quietly put a push
   * from two months ago above one from this morning.
   *
   * Sorted on a copy: `featured` also feeds the Experience rows, which order
   * themselves by their own rules.
   *
   * `pushedAt` is "" for a repo the token can't see, and `Date.parse("")` is
   * NaN, which would make the comparator inconsistent and the sort unstable.
   * Those sort last instead.
   */
  const pushedTime = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  };
  const featuredRows = [...source]
    .sort((a, b) => pushedTime(b.pushedAt) - pushedTime(a.pushedAt))
    .slice(0, MAX_ROWS);

  const hasRows = useFeatured || repos.length > 0;

  return (
    <section aria-labelledby="activity-heading" className="panel">
      <div className="panel-bar">
        <h2 id="activity-heading" className="panel-bar-title">
          Recent Activity
        </h2>
      </div>

      {/*
        `divide-y` rather than a gap. The sources were stacked with nothing
        between them, so three unrelated feeds read as one run-on list — Steam
        rules its showcase sections off from each other and that line is doing
        real work, not decoration.

        The divider is `line` at full strength, not a tint: at 40% it was
        there and still didn't separate anything.
      */}
      {/*
        No `divide-y` any more — each block draws its own rule, so a rule can
        light up with the block it belongs to. The rules also fade out at both
        ends now rather than running edge to edge, which stops three hard lines
        cutting the panel into strips.
      */}
      <div className="flex flex-col p-5 pt-3">
        <SourceBlock
          name="GitHub"
          icon={<GitHubIcon className="h-4 w-4 text-muted" />}
          className="pb-5"
        >
          {hasRows ? (
            <ul className="flex flex-col">
              {useFeatured
                ? featuredRows.map((repo) => (
                      <FeaturedRepoRow
                        key={repo.nameWithOwner}
                        repo={repo}
                        now={now}
                      />
                    ))
                : repos
                    .slice(0, MAX_ROWS)
                    .map((repo) => (
                      <PublicRepoRow key={repo.id} repo={repo} now={now} />
                    ))}
            </ul>
          ) : (
            <div className="solid bg-panel2/70 px-5 py-10 text-center">
              <p className="t-label">
                {snapshot.error ?? "No repository activity to show"}
              </p>
            </div>
          )}
        </SourceBlock>

        {/*
          Hidden entirely when Spotify isn't configured or returned nothing —
          same contract as the DevEval block. An empty "Spotify" heading would
          claim a source the page doesn't actually have.
        */}
        {tracks.length > 0 && (
          <SourceBlock
            name="Spotify"
            icon={<SpotifyIcon className="h-4 w-4 text-muted" />}
            className="py-5"
            rule
          >
            <ul className="flex flex-col">
              {tracks.map((track) => (
                <TrackRow key={track.url} track={track} now={now} />
              ))}
            </ul>
          </SourceBlock>
        )}

        <SourceBlock
          name="Books"
          icon={<BookIcon className="h-4 w-4 text-muted" />}
          /*
            Less bottom padding than the other two blocks. They end on a row of
            text, which needs its own breathing room; this one ends on the
            "Recent reads" caption, which already sits `mt-6` clear of the
            shelf — so the block's own padding was stacking on top of a gap
            that was already there.
          */
          className="pb-2 pt-5"
          rule
        >
          <Bookshelf />
        </SourceBlock>

        {/*
          Steam's "View All Activity | Repositories | Stars" footer was here
          and is gone, at Bradley's request — see the open item in CLAUDE.md.

          It's coming back as **All Activity pointing at this site**, not at
          GitHub: one page listing everything in chronological order, with the
          sources interleaved rather than grouped by which app they came from.
          The panel above groups by source because each block is a different
          shape; that page is the opposite view of the same data and is the
          reason to remove this rather than repoint it now. Not built yet, so
          there is nothing to link to, and a footer of links to someone else's
          site is the wrong placeholder for it.
        */}
      </div>
    </section>
  );
}
