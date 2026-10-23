import { DEVEVAL_ROWS, type DevEvalStats } from "@/lib/deveval";
import type { Contributions, LanguageCount } from "@/lib/github";
import type { GitHubSnapshot } from "@/lib/github";
import {
  hackathonWins,
  projects,
  socials,
  techStack,
} from "@/lib/profile-data";
import { SOCIAL_ICONS, type SocialIconName } from "@/components/SocialIcons";

interface SidebarProps {
  snapshot: GitHubSnapshot;
  /** Null when DEVEVAL_STATS_URL isn't set or the endpoint is unreachable. */
  deveval: DevEvalStats | null;
  /** Null without a token — GraphQL is auth-only. */
  contributions: Contributions | null;
  /** All-repo breakdown. Empty without a token — falls back to public-only. */
  languages: LanguageCount[];
  /** ISO timestamp of the most recent push, or null without a token. */
  lastPush: string | null;
  /**
   * Comments on the site's own discussion thread. Null without a token, in
   * which case the row keeps its em-dash rather than claiming a zero.
   */
  commentCount: number | null;
}

/**
 * A grey label with a large light number, Steam's sidebar stat row.
 *
 * `href` turns the whole row into a jump link — used by Comments, which has a
 * panel further down the page to land on. The row still looks identical; only
 * the label picks up a hover colour, because underlining a stat row or
 * colouring the number would make it read as a different kind of thing from
 * the rows either side of it.
 */
function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value?: number | string | null;
  href?: string;
}) {
  const body = (
    <>
      <span
        className={`stat-label ${href ? "group-hover/stat:text-link" : ""}`}
      >
        {label}
      </span>
      {value !== null && value !== undefined && (
        <span className="stat-value">{value}</span>
      )}
    </>
  );

  return href ? (
    /*
      **No `transition-colors` here, deliberately.** The row is a solid (see
      globals.css): a `transition-*` utility sits in a later layer than the
      solid system and replaces its `transition-property: transform` outright,
      which snapped the face to its lifted position while the walls still grew
      over 260ms — the base lifting off the page is the one thing the lift is
      built not to do. It was animating nothing anyway; the hover colour is on
      the label below, through `group-hover/stat`, and that span carries no
      transition of its own.
    */
    <a href={href} className="stat-row group/stat">
      {body}
    </a>
  ) : (
    <div className="stat-row">{body}</div>
  );
}

/**
 * Steam's three presence states, mapped onto push recency. The thresholds are
 * a judgement call, but every one of them is derived — nothing here asserts
 * presence the data can't support.
 */
/** "12 minutes", "6 hours", "3 days" — no "ago", the caller adds it. */
function sinceLabel(iso: string, now: number): string | null {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const mins = Math.max(0, Math.round((now - then) / 6e4));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

function pushStatus(lastPush: string | null, now: number) {
  const then = lastPush ? Date.parse(lastPush) : NaN;
  if (!Number.isFinite(then)) {
    return { label: "Currently Offline", tone: "text-muted" };
  }
  const hours = (now - then) / 36e5;
  if (hours < 6) return { label: "Currently Online", tone: "text-live" };
  if (hours < 72) return { label: "Recently Active", tone: "text-accent" };
  return { label: "Currently Offline", tone: "text-muted" };
}

export default function Sidebar({
  snapshot,
  deveval,
  contributions,
  languages,
  lastPush,
  commentCount,
}: SidebarProps) {
  const { stats } = snapshot;
  const now = Date.parse(snapshot.fetchedAt);
  const status = pushStatus(lastPush, now);
  const since = lastPush ? sinceLabel(lastPush, now) : null;
  // The token-backed breakdown sees private repos and every language per repo;
  // the snapshot's is public-only primaryLanguage and reads far too narrow.
  const langs = languages.length > 0 ? languages : snapshot.languages;

  return (
    <div className="flex flex-col gap-4">
      <section className="panel px-5 py-5">
        {/*
          Derived from the last push, not hardcoded. This used to read
          "Currently Online" in green permanently, regardless of anything.
        */}
        {/*
          Linked to the GitHub profile, because that's where the status comes
          from — it's derived from the last push, so the link goes to the thing
          being measured rather than somewhere merely related. Falls back to
          plain text if the snapshot has no profile URL, so a failed fetch
          can't produce an anchor to nowhere.
        */}
        <h2 className={`text-[24px] font-normal leading-tight ${status.tone}`}>
          {stats?.profileUrl ? (
            <a
              href={stats.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="transition-opacity hover:opacity-80"
            >
              {status.label}
            </a>
          ) : (
            status.label
          )}
        </h2>
        {/* Says exactly what it measures — a push, not presence. */}
        {since && <p className="t-meta mt-1">Last commit {since}</p>}
        {/*
          Zero-value rows are hidden rather than listed. "Following 0 / Gists 0"
          fills space without telling anyone anything, and because the check is
          live each row returns on its own once the number moves. Followers,
          Reviews and Issues are cut outright — GitHub follower count says
          nothing here, and the other two were 0 with no prospect of moving.
        */}
        <div className="mt-5">
          {/*
            Labelled "Repos" at Bradley's request, but the value is still
            `publicRepos` — the REST user endpoint's public count, which can't
            see his private repos. The shorter label reads as a total it isn't.
          */}
          <Stat
            label="Repos"
            value={stats?.publicRepos ?? "—"}
            href={stats?.profileUrl}
          />
          {/*
            Was "Projects", counted from the `projects` array. The relabel
            forced the value to change with it: 3 is how many entries that
            array has, not how many were won, and leaving it would have made
            the page state a figure it never measured. See `hackathonWins`.
          */}
          {/*
            Points at Portfolio on /about, which is where the two wins are —
            Guardian and T-ETHER, both carrying a winner chip. It's the only
            stat in this column that leaves the profile page, and it does so
            because the thing it counts lives on the other one.
          */}
          <Stat
            label="Hackathon Wins"
            value={hackathonWins ?? "—"}
            href="/about#portfolio-heading"
          />
          {!!stats?.following && (
            <Stat label="Following" value={stats.following} />
          )}
          {!!stats?.publicGists && (
            <Stat label="Gists" value={stats.publicGists} />
          )}
        </div>

        {/*
          Contributions used to be its own panel. It's the same subject as the
          status above it — how active he is — so it reads better as a second
          group in one box than as a second box.
        */}
        {/*
          Down to the total. The type breakdown (pull requests, merged, repos
          created) was stripped row by row at Bradley's request, so this is now
          a single figure rather than a group — but `getContributions()` still
          returns the rest, ready if any of it comes back.

          Labelled "this year", and the query was changed to match: the
          contributions API defaults to the trailing twelve months, so the
          label would otherwise have described a window the number wasn't
          measured over. `getContributions()` now passes 1 January.
        */}
        {/*
          No top margin: the 28px that used to sit here was a leftover from
          when this was its own panel, and inside one box it read as a gap
          rather than a grouping. It's the same kind of row as the four above
          it, so it sits in the same rhythm.
        */}
        {contributions && (
          <Stat
            label="Contributions this year"
            value={contributions.total.toLocaleString()}
            href={stats?.profileUrl}
          />
        )}

        {/*
          Two rows with no number yet, shown as an em-dash rather than a zero.

          "Comments 0" would be a claim — that the count was fetched and came
          back empty — when in fact nothing counts them: giscus isn't wired
          into the page yet (see components/Comments.tsx). The dash says the
          row exists and the number doesn't, which is the truth. Same for
          Artwork / Portfolio, which has no source at all.

          Wire each to a real count when there is one — `Stat` already renders
          nothing but the label if the value is null, so passing the number is
          the whole change.
        */}
        {/*
          A real count now, and a link down to the panel it counts. It was an
          em-dash because nothing counted comments; giscus posts into a GitHub
          Discussion, so `getDiscussionComments` can. Without a token it falls
          back to the dash rather than claiming a zero.
        */}
        <Stat
          label="Comments"
          value={commentCount ?? "—"}
          href="#comments-heading"
        />
        {/*
          Links to Portfolio on /about, like Hackathon Wins above it, and the
          number is now `projects.length` — so adding a row over there moves
          this one, and neither can drift from the other.
          
          Note what it counts: **Portfolio entries, not artwork.** The label
          names both because the row was built to hold both eventually, and
          there is no artwork on this site yet. If any lands, this has to
          become a sum rather than one array's length, or the number will go
          on describing half of its own label.

          This is the opposite call from Hackathon Wins two rows up, which is
          hand-set precisely because `projects.length` is *not* what it means.
          A derived count is right when the label is the thing being counted
          and wrong when it only happens to match.
        */}
        <Stat
          label="Artwork / Portfolio"
          value={projects.length}
          href="/about#portfolio-heading"
        />
      </section>

      {/*
        The one block on this page fed by Bradley's own product rather than
        someone else's API. Absent entirely when the endpoint isn't configured
        or is down — never a placeholder number.
      */}
      {deveval && (
        <section className="panel px-5 py-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-normal leading-tight text-bright">
              DevEval
            </h2>
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-live"
                aria-hidden
              />
              <span className="t-meta text-live">Live</span>
            </span>
          </div>
          <p className="t-meta mt-1">Straight off the DevEval API.</p>

          <div className="mt-4">
            {DEVEVAL_ROWS.map(({ key, label }) =>
              deveval[key] === undefined ? null : (
                <div key={key} className="stat-row">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">
                    {deveval[key]!.toLocaleString()}
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      {/*
        Tech Stack, between the status block and Languages.

        Derived from the `tags` already on roles and projects (see `techStack`),
        not a separate hand-kept list — so nothing can appear here that isn't
        attached to real work elsewhere on the page, and adding a tag to a role
        puts it on the stack by itself.

        It sits above Languages deliberately: Languages is what GitHub counted,
        this is what he'd say he works in, and the derived one reads better as
        the footnote to the stated one than the other way round.
      */}
      {techStack.length > 0 && (
        <section className="panel px-5 py-5">
          <div className="stat-row">
            <span className="stat-label">Tech Stack</span>
            <span className="stat-value">{techStack.length}</span>
          </div>

          {/*
            Chips rather than the mono dot-list the same tags use in
            Experience. There they're a footnote under a role and shouldn't
            compete with it; here they're the content of the panel.
          */}
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {techStack.map((tech) => (
              <li
                key={tech}
                className="solid solid-thin solid-edged border border-line/70 bg-panel2/60 px-2 py-1 text-[12px] leading-none text-copy"
              >
                {tech}
              </li>
            ))}
          </ul>
        </section>
      )}

      {langs.length > 0 && (
        <section className="panel px-5 py-5">
          <div className="stat-row">
            <span className="stat-label">Languages</span>
            <span className="stat-value">{langs.length}</span>
          </div>
          {/*
            A plain list, not bars. Bars here were scaled against the most-used
            language, which is an arbitrary denominator that conveys nothing —
            the repo count already says everything the bar was implying.
          */}
          <ul className="mt-2 flex flex-col">
            {langs.map((language) => (
              <li
                key={language.name}
                className="solid-hover flex items-baseline justify-between gap-2 py-1"
              >
                <span className="t-body">{language.name}</span>
                <span className="t-meta">
                  {language.repos} {language.repos === 1 ? "repo" : "repos"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel px-5 py-5">
        {/*
          Heading only — the count is gone. It was `socials.length`, and with
          the icons sitting directly beneath it a reader could just see how
          many there were; the number restated something already visible, and
          two of the six it counted aren't even linked yet.
        */}
        <div className="stat-row">
          <span className="stat-label">Links</span>
        </div>
        {/*
          A row of marks rather than a list of words.

          The LinkedIn follower count went with the words. It was the only
          number here and had nowhere to sit once the label became a 20px
          icon — and it was the one figure on this page typed by hand rather
          than fetched, since LinkedIn has no public API. The constant behind
          it has since been deleted; wanting it back means re-adding it, and
          re-checking it, by hand.

          Each icon keeps its label as the accessible name and as the tooltip,
          so nothing is lost to someone who can't identify a mark on sight.
        */}
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          {socials.map((link) => {
            const Icon = SOCIAL_ICONS[link.icon as SocialIconName];
            if (!Icon) return null;

            /*
              No href yet: render the mark greyed and unlinked rather than
              dropping it or pointing it somewhere invented. `title` still
              says which platform it is and that it's not wired up.
            */
            if (!link.href) {
              return (
                <li key={link.label}>
                  <span
                    title={`${link.label} — coming soon`}
                    className="block text-muted/35"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="sr-only">
                      {link.label} — not linked yet
                    </span>
                  </span>
                </li>
              );
            }

            return (
              <li key={link.label}>
                <a
                  href={link.href}
                  title={link.label}
                  target={
                    link.href.startsWith("mailto:") ? undefined : "_blank"
                  }
                  rel="noreferrer"
                  className="block text-muted transition-colors hover:text-link"
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{link.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
