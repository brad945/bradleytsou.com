/**
 * Public GitHub REST API, called straight from server components.
 *
 * No backend, no database, no token required. `GITHUB_TOKEN` is honoured if
 * present (raises the rate limit from 60/hr/IP to 5000/hr) but the site is
 * designed to work without it.
 *
 * Every failure mode — bad username, rate limit, network — degrades to an
 * empty snapshot rather than throwing, so a placeholder username can't break
 * the build or 500 the page.
 */

import {
  hiddenFromActivity,
  PLACEHOLDER_GITHUB_USERNAME,
} from "@/lib/profile-data";

const API = "https://api.github.com";

/** Seconds. Matches the "refreshes every 5 minutes" behaviour of the feed. */
export const REVALIDATE_SECONDS = 300;

export type FeedKind =
  | "push"
  | "pr"
  | "pr-merged"
  | "repo"
  | "release"
  | "issue"
  | "star"
  | "fork"
  | "other";

export interface FeedItem {
  id: string;
  kind: FeedKind;
  /** Killfeed verb, e.g. "PUSH", "MERGE". Rendered in the weapon-chip slot. */
  verb: string;
  /** The thing acted on — repo name, always the "victim" side of the feed. */
  target: string;
  /** Optional right-hand detail: commit message, PR title, tag name. */
  detail?: string;
  /** Numeric multiplier, e.g. 3 commits in one push. */
  count?: number;
  /** Marks a standout event (merged PR, release) — renders a highlight tick. */
  headshot: boolean;
  url: string;
  /** ISO timestamp. */
  at: string;
}

export interface GitHubStats {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  publicRepos: number;
  publicGists: number;
  followers: number;
  following: number;
  /** Year the account was created — the "member since" row. */
  memberSince: number | null;
  /** Public events in the last 14 days — the "hours past 2 weeks" analogue. */
  eventsPast2Weeks: number;
}

/** A recently-pushed repo, rendered in the "recently played" slot. */
export interface RepoCard {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
  url: string;
  /** Commits pushed to this repo in the last 14 days, from the events feed. */
  commitsPast2Weeks: number;
}

/** Language usage across owned repos — the sidebar's breakdown block. */
export interface LanguageCount {
  name: string;
  repos: number;
}

export interface GitHubSnapshot {
  ok: boolean;
  /** Human-readable reason the snapshot is empty, or null. */
  error: string | null;
  stats: GitHubStats | null;
  feed: FeedItem[];
  /** Most recently pushed, for the "recently played" rows. */
  repos: RepoCard[];
  /** Most starred, for the sidebar list. */
  topRepos: RepoCard[];
  /**
   * Names of the owner's repos that came back from the public API. The
   * unauthenticated endpoint only returns public repos, so membership here is
   * a reliable "is this repo visible to a visitor" check — which is what stops
   * the header linking a private repo nobody else can open.
   */
  publicRepoNames: string[];
  languages: LanguageCount[];
  /** When this snapshot was built, ISO. */
  fetchedAt: string;
}

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  html_url: string;
  fork: boolean;
  archived: boolean;
}

interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo?: { name: string };
  payload?: {
    size?: number;
    ref?: string;
    ref_type?: string;
    action?: string;
    commits?: { message: string }[];
    pull_request?: {
      title: string;
      merged?: boolean;
      html_url?: string;
      number?: number;
    };
    issue?: { title: string; html_url?: string; number?: number };
    release?: { tag_name?: string; html_url?: string };
  };
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "bradleytsou-site",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function getJson<T>(
  path: string,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: headers(),
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      if (res.status === 404)
        return { data: null, error: "GitHub user not found" };
      if (res.status === 403 || res.status === 429) {
        return { data: null, error: "GitHub rate limit reached" };
      }
      return { data: null, error: `GitHub responded ${res.status}` };
    }

    return { data: (await res.json()) as T, error: null };
  } catch {
    return { data: null, error: "Could not reach GitHub" };
  }
}

/** Strip the `owner/` prefix — the killfeed only has room for the repo name. */
function shortRepo(full: string | undefined): string {
  if (!full) return "unknown";
  const slash = full.indexOf("/");
  return slash === -1 ? full : full.slice(slash + 1);
}

function firstLine(text: string | undefined, max = 72): string | undefined {
  if (!text) return undefined;
  const line = text.split("\n")[0].trim();
  if (!line) return undefined;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function repoUrl(full: string | undefined): string {
  return full ? `https://github.com/${full}` : "https://github.com";
}

/**
 * Translate a raw GitHub event into a killfeed line.
 * Returns null for event types that aren't worth a line.
 */
function toFeedItem(event: GitHubEvent): FeedItem | null {
  const repo = event.repo?.name;
  const target = shortRepo(repo);
  const base = { id: event.id, target, at: event.created_at, headshot: false };
  const p = event.payload ?? {};

  switch (event.type) {
    case "PushEvent": {
      const count = p.size ?? p.commits?.length ?? 1;
      return {
        ...base,
        kind: "push",
        verb: "PUSH",
        count,
        detail: firstLine(p.commits?.[p.commits.length - 1]?.message),
        url: repoUrl(repo),
      };
    }
    case "PullRequestEvent": {
      const merged = Boolean(p.pull_request?.merged);
      if (p.action !== "opened" && !merged) return null;
      return {
        ...base,
        kind: merged ? "pr-merged" : "pr",
        verb: merged ? "MERGE" : "OPEN PR",
        detail: firstLine(p.pull_request?.title),
        headshot: merged,
        url: p.pull_request?.html_url ?? repoUrl(repo),
      };
    }
    case "CreateEvent": {
      if (p.ref_type !== "repository") return null;
      return {
        ...base,
        kind: "repo",
        verb: "NEW REPO",
        headshot: true,
        url: repoUrl(repo),
      };
    }
    case "ReleaseEvent": {
      return {
        ...base,
        kind: "release",
        verb: "RELEASE",
        detail: p.release?.tag_name,
        headshot: true,
        url: p.release?.html_url ?? repoUrl(repo),
      };
    }
    case "IssuesEvent": {
      if (p.action !== "opened" && p.action !== "closed") return null;
      return {
        ...base,
        kind: "issue",
        verb: p.action === "closed" ? "CLOSE" : "ISSUE",
        detail: firstLine(p.issue?.title),
        url: p.issue?.html_url ?? repoUrl(repo),
      };
    }
    case "WatchEvent":
      return { ...base, kind: "star", verb: "STAR", url: repoUrl(repo) };
    case "ForkEvent":
      return { ...base, kind: "fork", verb: "FORK", url: repoUrl(repo) };
    default:
      return null;
  }
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function countPast2Weeks(events: GitHubEvent[], now: number): number {
  const cutoff = now - TWO_WEEKS_MS;
  return events.filter((e) => {
    const t = Date.parse(e.created_at);
    return Number.isFinite(t) && t >= cutoff;
  }).length;
}

/** Commits per repo (short name) pushed in the last 14 days. */
function commitsByRepo(
  events: GitHubEvent[],
  now: number,
): Map<string, number> {
  const cutoff = now - TWO_WEEKS_MS;
  const counts = new Map<string, number>();

  for (const event of events) {
    if (event.type !== "PushEvent") continue;
    const t = Date.parse(event.created_at);
    if (!Number.isFinite(t) || t < cutoff) continue;

    const name = shortRepo(event.repo?.name);
    const size = event.payload?.size ?? event.payload?.commits?.length ?? 1;
    counts.set(name, (counts.get(name) ?? 0) + size);
  }

  return counts;
}

/**
 * One call for everything the page needs. Never throws.
 *
 * @param username  GitHub handle.
 * @param limit     Max killfeed rows to return.
 * @param repoLimit Max recently-pushed repo cards to return.
 */
export async function getGitHubSnapshot(
  username: string,
  limit = 12,
  repoLimit = 3,
): Promise<GitHubSnapshot> {
  const fetchedAt = new Date().toISOString();
  const empty: GitHubSnapshot = {
    ok: false,
    error: null,
    stats: null,
    feed: [],
    repos: [],
    topRepos: [],
    publicRepoNames: [],
    languages: [],
    fetchedAt,
  };

  if (!username || username === PLACEHOLDER_GITHUB_USERNAME) {
    return { ...empty, error: "GitHub username not configured yet" };
  }

  const handle = encodeURIComponent(username);
  const [user, events, repos] = await Promise.all([
    getJson<GitHubUser>(`/users/${handle}`),
    getJson<GitHubEvent[]>(`/users/${handle}/events/public?per_page=100`),
    getJson<GitHubRepo[]>(
      `/users/${handle}/repos?type=owner&sort=pushed&per_page=12`,
    ),
  ]);

  if (!user.data) {
    return { ...empty, error: user.error ?? "GitHub profile unavailable" };
  }

  const rawEvents = Array.isArray(events.data) ? events.data : [];
  const feed = rawEvents
    .map(toFeedItem)
    .filter((item): item is FeedItem => item !== null)
    .slice(0, limit);

  // Forks and archives would dominate the "recently played" slot without
  // saying anything about what Bradley is actually working on.
  const commits = commitsByRepo(rawEvents, Date.parse(fetchedAt));
  const owned: RepoCard[] = (Array.isArray(repos.data) ? repos.data : [])
    .filter((r) => !r.fork && !r.archived)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      pushedAt: r.pushed_at,
      url: r.html_url,
      commitsPast2Weeks: commits.get(r.name) ?? 0,
    }));

  // The API already returned these sorted by push date.
  const repoCards = owned.slice(0, repoLimit);
  const topRepos = [...owned].sort((a, b) => b.stars - a.stars).slice(0, 6);

  const languageCounts = new Map<string, number>();
  for (const repo of owned) {
    if (!repo.language) continue;
    languageCounts.set(
      repo.language,
      (languageCounts.get(repo.language) ?? 0) + 1,
    );
  }
  const languages: LanguageCount[] = Array.from(
    languageCounts,
    ([name, count]) => ({
      name,
      repos: count,
    }),
  )
    .sort((a, b) => b.repos - a.repos)
    .slice(0, 5);

  const createdAt = Date.parse(user.data.created_at);

  return {
    ok: true,
    error: events.data ? null : events.error,
    fetchedAt,
    stats: {
      login: user.data.login,
      name: user.data.name,
      avatarUrl: user.data.avatar_url,
      profileUrl: user.data.html_url,
      publicRepos: user.data.public_repos,
      publicGists: user.data.public_gists,
      followers: user.data.followers,
      following: user.data.following,
      memberSince: Number.isFinite(createdAt)
        ? new Date(createdAt).getUTCFullYear()
        : null,
      eventsPast2Weeks: countPast2Weeks(rawEvents, Date.parse(fetchedAt)),
    },
    feed,
    repos: repoCards,
    topRepos,
    publicRepoNames: (Array.isArray(repos.data) ? repos.data : []).map(
      (r) => r.name,
    ),
    languages,
  };
}

/* ------------------------------------------------------------------ *
 * Contribution calendar
 * ------------------------------------------------------------------ */

export interface Contributions {
  /** Total contributions since 1 January of the current year. */
  total: number;
  /** How many of those landed in private repos. */
  private: number;
  pullRequests: number;
  pullRequestsMerged: number;
  issues: number;
  reviews: number;
  repositoriesCreated: number;
}

/*
 * One document for the year's total plus what those contributions actually
 * were.
 *
 * `contributionsCollection` takes `from`, and it matters which one is passed.
 * With no argument it reports the **trailing twelve months**; the sidebar
 * labels this "Contributions this year", so it passes 1 January instead and
 * the label is then literally true. Omitting `from` and keeping that label
 * would have put an invented framing on a fetched number, which is the exact
 * failure the rest of this file exists to avoid. GitHub caps the window at a
 * year, and 1 January to now is always inside that.
 *
 * The `total*Contributions` fields can't supply the breakdown: they count
 * PUBLIC contributions only, and for a mostly-private account that reads
 * "0 pull requests" while the person has opened plenty. The author-scoped
 * search counts do see private repos the token can read, so the breakdown
 * comes from there instead.
 */
const CONTRIBUTIONS_QUERY = `
  query($login: String!, $from: DateTime!, $prs: String!, $merged: String!, $issues: String!, $reviews: String!) {
    user(login: $login) {
      contributionsCollection(from: $from) {
        contributionCalendar { totalContributions }
        restrictedContributionsCount
        totalRepositoryContributions
      }
    }
    prs:      search(query: $prs,     type: ISSUE, first: 1) { issueCount }
    merged:   search(query: $merged,  type: ISSUE, first: 1) { issueCount }
    issues:   search(query: $issues,  type: ISSUE, first: 1) { issueCount }
    reviews:  search(query: $reviews, type: ISSUE, first: 1) { issueCount }
  }
`;

interface CalendarResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: { totalContributions?: number };
        restrictedContributionsCount?: number;
        totalRepositoryContributions?: number;
      };
    };
    prs?: { issueCount?: number };
    merged?: { issueCount?: number };
    issues?: { issueCount?: number };
    reviews?: { issueCount?: number };
  };
}

/**
 * The contribution calendar, GitHub's closest thing to Steam's "hours played".
 *
 * Only available over GraphQL, which is auth-only — so this needs
 * `GITHUB_TOKEN` and returns null without it. Private contributions are
 * included only when the account has "Include private contributions on my
 * profile" enabled; with it off the total collapses to public activity alone,
 * which for a mostly-private account is a near-flat chart.
 *
 * Never throws: no token, non-OK, GraphQL errors, or an unexpected shape all
 * return null and the panel hides itself.
 */
export async function getContributions(
  username: string,
): Promise<Contributions | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !username || username === PLACEHOLDER_GITHUB_USERNAME)
    return null;

  let body: CalendarResponse;
  try {
    const res = await fetch(`${API}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "bradleytsou-site",
      },
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: {
          login: username,
          /*
           * Built from the server's clock rather than a constant, so it rolls
           * over on its own each January. `Date.UTC` because GitHub reads the
           * window in UTC — a local-midnight string would shift the boundary
           * by the host's offset.
           */
          from: new Date(
            Date.UTC(new Date().getUTCFullYear(), 0, 1),
          ).toISOString(),
          prs: `author:${username} is:pr`,
          merged: `author:${username} is:pr is:merged`,
          issues: `author:${username} is:issue`,
          reviews: `reviewed-by:${username} is:pr`,
        },
      }),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    body = (await res.json()) as CalendarResponse;
  } catch {
    return null;
  }

  const collection = body.data?.user?.contributionsCollection;
  const total = collection?.contributionCalendar?.totalContributions;
  if (typeof total !== "number" || total === 0) return null;

  return {
    total,
    private: collection?.restrictedContributionsCount ?? 0,
    pullRequests: body.data?.prs?.issueCount ?? 0,
    pullRequestsMerged: body.data?.merged?.issueCount ?? 0,
    issues: body.data?.issues?.issueCount ?? 0,
    reviews: body.data?.reviews?.issueCount ?? 0,
    repositoriesCreated: collection?.totalRepositoryContributions ?? 0,
  };
}

/* ------------------------------------------------------------------ *
 * Featured repositories
 * ------------------------------------------------------------------ */

export interface FeaturedRepo {
  nameWithOwner: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  url: string;
  /**
   * The repo's own "Website" field on GitHub, when it has one.
   *
   * Fetched rather than kept in a map here, because GitHub already holds it —
   * `sennaicodes/deveval` has deveval.com set. A hand-kept list would be
   * a second copy of a fact that already exists and can go stale against it.
   */
  homepage: string | null;
  description: string | null;
  language: string | null;
  pushedAt: string;
  stars: number;
  /** Commits authored by the profile owner. */
  myCommits: number;
  /** Commits in the repo by everyone. */
  totalCommits: number;
  /** Commits the profile owner pushed here in the last 14 days. */
  myCommitsPast2Weeks: number;
}

/**
 * A repo's GitHub "Website" field, as something an `href` can actually use.
 *
 * GitHub stores that field as typed and doesn't insist on a scheme:
 * `brad945/bradleytsou.com` holds the bare "bradleytsou.com". A bare host in
 * an `href` is a *relative path*, so that row pointed at
 * /bradleytsou.com on this site and 404'd — a dead link that looked
 * like a working one, since the text beside it was right.
 *
 * Empty string, not null, is what GitHub returns for "no website".
 */
function websiteUrl(raw: string | null | undefined): string | null {
  const url = raw?.trim();
  if (!url) return null;
  // Scheme-relative already resolves correctly; it just has no scheme to test.
  if (url.startsWith("//")) return `https:${url}`;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * One GraphQL request, or null.
 *
 * Shared by the two repo queries below, which need the same auth, the same
 * cache window and the same "degrade quietly" contract as everything else in
 * this file. Returns null without a token or on any non-OK response rather
 * than throwing — a GitHub hiccup costs a panel, not the page.
 */
async function githubGraphQL(
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: Record<string, any> } | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  const res = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "bradleytsou-site",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;
  return (await res.json()) as { data?: Record<string, any> };
}

/**
 * The profile owner's own node id.
 *
 * The commit-history author filter takes a node id and GraphQL can't derive
 * one inside the same document, so this is a separate round trip. It's cached
 * on the same window as everything else and the answer never changes.
 */
async function getViewerId(): Promise<string | null> {
  const me = await githubGraphQL(`query { viewer { id } }`);
  return me?.data?.viewer?.id ?? null;
}

/**
 * Every field behind a `FeaturedRepo`, as one fragment.
 *
 * Shared so the two queries can't drift apart — they return the same shape and
 * `toFeaturedRepo` reads both. Any query spreading it must declare `$who` and
 * `$since`, which the author-scoped history counts use.
 */
const REPO_FRAGMENT = `fragment S on Repository {
   nameWithOwner name owner { login } isPrivate isArchived url homepageUrl description pushedAt stargazerCount
   primaryLanguage { name }
   defaultBranchRef { target { ... on Commit {
     all: history { totalCount }
     mine: history(author: {id: $who}) { totalCount }
     recent: history(author: {id: $who}, since: $since) { totalCount }
   } } }
 }`;

/** A `REPO_FRAGMENT` node as the rest of the site consumes it. */
function toFeaturedRepo(r: any): FeaturedRepo {
  const target = r.defaultBranchRef?.target;
  return {
    nameWithOwner: r.nameWithOwner,
    name: r.name,
    owner: r.owner?.login ?? "",
    isPrivate: Boolean(r.isPrivate),
    url: r.url,
    homepage: websiteUrl(r.homepageUrl),
    description: r.description ?? null,
    language: r.primaryLanguage?.name ?? null,
    pushedAt: r.pushedAt ?? "",
    stars: r.stargazerCount ?? 0,
    myCommits: target?.mine?.totalCount ?? 0,
    totalCommits: target?.all?.totalCount ?? 0,
    myCommitsPast2Weeks: target?.recent?.totalCount ?? 0,
  };
}

/** The variables `REPO_FRAGMENT` needs, for either query. */
function repoQueryVariables(viewerId: string) {
  return {
    who: viewerId,
    since: new Date(Date.now() - TWO_WEEKS_MS).toISOString(),
  };
}

/**
 * Hand-picked repos, by `owner/name`.
 *
 * This is no longer what Recent Activity lists — see `getRecentRepos` — but it
 * is still what the Experience and Portfolio rows look their live data up in,
 * and it's the fallback if the recency query comes back empty. So the list
 * stays curated: a role's `ghRepo` has to resolve to something.
 *
 * Commits are reported as "yours / total", never just the repo total: on a
 * shared repo the total says nothing about his contribution, and overstating
 * it is the kind of thing a reader can check. Recent commits are author-scoped
 * too, so the "past 2 weeks" figure is his activity, not the repo's.
 *
 * Needs `GITHUB_TOKEN` (private repos and the author filter both require auth).
 * Returns an empty array without one, and the caller falls back to the public
 * list rather than showing nothing.
 */
export async function getFeaturedRepos(
  names: string[],
): Promise<FeaturedRepo[]> {
  if (!process.env.GITHUB_TOKEN || names.length === 0) return [];

  try {
    const viewerId = await getViewerId();
    if (!viewerId) return [];

    const parsed = names
      .map((full) => {
        const [owner, name] = full.split("/");
        return owner && name ? { owner, name } : null;
      })
      .filter((x): x is { owner: string; name: string } => x !== null);
    if (parsed.length === 0) return [];

    const fields = parsed
      .map(
        (r, i) =>
          `r${i}: repository(owner: ${JSON.stringify(r.owner)}, name: ${JSON.stringify(r.name)}) { ...S }`,
      )
      .join("\n");

    const body = await githubGraphQL(
      `query($who: ID!, $since: GitTimestamp!) {
         ${fields}
       }
       ${REPO_FRAGMENT}`,
      repoQueryVariables(viewerId),
    );

    const data = body?.data;
    if (!data) return [];

    const out: FeaturedRepo[] = [];
    parsed.forEach((_, i) => {
      const r = data[`r${i}`];
      if (!r) return; // repo renamed, deleted, or no longer visible to the token
      out.push(toFeaturedRepo(r));
    });
    return out;
  } catch {
    return [];
  }
}

/**
 * How many repos the recency query considers before filtering.
 *
 * Deliberately well above the three rows that get shown: archived repos, and
 * repos Bradley has no commits in, are dropped *after* the fetch, so asking
 * for exactly three would let one of those shorten the panel.
 */
const RECENT_CANDIDATES = 20;

/**
 * Repos Bradley pushed to most recently — what Recent Activity lists.
 *
 * **This is not the automatic list that `featuredRepos` replaced.** That one
 * read `getGitHubSnapshot`'s repo list, which is public repos he *owns*, so it
 * surfaced years-old intro projects while missing his private work and
 * everything he contributes to in someone else's org. This one is the
 * authenticated `viewer` query across all three affiliations, so the repos that
 * were invisible to it are the first things it returns.
 *
 * Two filters, and the second is the load-bearing one:
 *
 * - **Archived and forked repos are out.** They'd crowd the slot without
 *   saying anything, the same reason `getGitHubSnapshot` drops them.
 * - **He must have commits in it.** `pushedAt` is the repo's last push by
 *   *anyone*, and with `ORGANIZATION_MEMBER` in the query a teammate pushing
 *   to an org repo would otherwise put that repo on this page as Bradley's
 *   recent activity. Two org repos he's a member of sit there with zero
 *   commits from him right now, so this isn't hypothetical. The whole site
 *   reports "yours / total" rather than a repo total for the same reason.
 *
 * What it can't filter is judgement: a push to a coursework repo puts that
 * repo at the top, and the curated list existed partly to keep those out.
 * Bradley chose automatic over curated knowing that, and the lever over it is
 * `hiddenFromActivity` in `profile-data` — a skip list, not a return to
 * hand-picking. It lives there rather than here because it's content he
 * maintains, next to `featuredRepos`.
 *
 * Private repos appear by name, as they already did when hand-picked — they
 * just aren't linked, since a visitor would get a 404. That's the disclosure
 * the skip list exists for.
 *
 * Needs `GITHUB_TOKEN`; without it this is empty and the caller falls back to
 * the curated list, then to the public one.
 */
export async function getRecentRepos(limit: number): Promise<FeaturedRepo[]> {
  if (!process.env.GITHUB_TOKEN || limit <= 0) return [];

  try {
    const viewerId = await getViewerId();
    if (!viewerId) return [];

    const body = await githubGraphQL(
      `query($who: ID!, $since: GitTimestamp!) {
         viewer {
           repositories(
             first: ${RECENT_CANDIDATES}
             orderBy: { field: PUSHED_AT, direction: DESC }
             affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
             ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
             isFork: false
           ) { nodes { ...S } }
         }
       }
       ${REPO_FRAGMENT}`,
      repoQueryVariables(viewerId),
    );

    const nodes = body?.data?.viewer?.repositories?.nodes;
    if (!Array.isArray(nodes)) return [];

    const skipped = new Set(hiddenFromActivity.map((n) => n.toLowerCase()));

    return nodes
      .filter((r: any) => r && !r.isArchived)
      .map(toFeaturedRepo)
      .filter((r) => r.myCommits > 0)
      .filter((r) => !skipped.has(r.nameWithOwner.toLowerCase()))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Language breadth
 * ------------------------------------------------------------------ */

/**
 * Languages across every repo the token can see, counted by how many repos use
 * each.
 *
 * Two deliberate choices, both learned the hard way:
 *
 * 1. NOT `primaryLanguage` from the REST repo list. That's one language per
 *    repo, from public repos only — and most of Bradley's public repos are
 *    small enough that GitHub detects no language at all, which collapsed the
 *    whole panel to "JavaScript, 1 repo".
 * 2. Counted by REPO, not by bytes. Byte share is what GitHub's own bar shows
 *    and it's badly skewed by vendored and generated files — HTML reads 53.8%
 *    here off 21MB nobody hand-wrote, while TypeScript reads 0.6%. Repo count
 *    says something true about breadth.
 *
 * Needs `GITHUB_TOKEN`; returns [] without one and the caller falls back to
 * the public-only breakdown.
 */
export async function getLanguages(limit = 8): Promise<LanguageCount[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

  const query = `
    query {
      viewer {
        repositories(first: 100, affiliations: [OWNER, COLLABORATOR], isFork: false) {
          nodes {
            languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
              edges { node { name } }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(`${API}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "bradleytsou-site",
      },
      body: JSON.stringify({ query }),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];

    const body = (await res.json()) as {
      data?: {
        viewer?: {
          repositories?: {
            nodes?: {
              languages?: { edges?: { node?: { name?: string } }[] };
            }[];
          };
        };
      };
    };

    const nodes = body.data?.viewer?.repositories?.nodes;
    if (!Array.isArray(nodes)) return [];

    const counts = new Map<string, number>();
    for (const repo of nodes) {
      for (const edge of repo.languages?.edges ?? []) {
        const name = edge.node?.name;
        // Procfile and friends are config, not languages worth listing.
        if (!name || name === "Procfile") continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }

    return Array.from(counts, ([name, repos]) => ({ name, repos }))
      .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Last activity
 * ------------------------------------------------------------------ */

/**
 * Timestamp of the most recent push across every repo the token can see.
 *
 * Drives the sidebar's online/offline state, which was previously a hardcoded
 * "Currently Online" that rendered green whether or not anything was true.
 *
 * Honest about what it measures: this is when Bradley last *pushed*, not when
 * he was last working. He can code for hours without pushing, so the label
 * built on it says "last commit", not "last seen". Swapping in a real
 * editor-time source (WakaTime) later only needs to change this function.
 *
 * Needs `GITHUB_TOKEN` to see private repos; returns null without one and the
 * status falls back to a plain heading.
 */
export async function getLastPush(): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const query = `
    query {
      viewer {
        repositories(first: 1, affiliations: [OWNER, COLLABORATOR], isFork: false,
                     orderBy: {field: PUSHED_AT, direction: DESC}) {
          nodes { pushedAt }
        }
      }
    }
  `;

  try {
    const res = await fetch(`${API}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "bradleytsou-site",
      },
      body: JSON.stringify({ query }),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: {
        viewer?: { repositories?: { nodes?: { pushedAt?: string }[] } };
      };
    };
    const pushedAt = body.data?.viewer?.repositories?.nodes?.[0]?.pushedAt;
    return typeof pushedAt === "string" && Number.isFinite(Date.parse(pushedAt))
      ? pushedAt
      : null;
  } catch {
    return null;
  }
}

/**
 * How many comments are on the site's own discussion thread.
 *
 * This is what turns the sidebar's Comments row from an em-dash into a number.
 * The row showed a dash because nothing counted them; giscus posts into a real
 * GitHub Discussion, so now something can.
 *
 * **Counts replies too.** giscus renders a reply as a comment, so counting only
 * top-level ones would show a smaller number than the panel visibly contains —
 * the row would contradict the thing it sits above.
 *
 * Auth-only, like the rest of the GraphQL here: no token, `null`, and the row
 * falls back to the dash rather than claiming a zero it never counted.
 */
export async function getDiscussionComments(
  owner: string,
  repo: string,
  number: number,
): Promise<number | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        discussion(number: $number) {
          comments(first: 100) {
            totalCount
            nodes { replies(first: 0) { totalCount } }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(`${API}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "bradleytsou-site",
      },
      body: JSON.stringify({ query, variables: { owner, repo, number } }),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: {
        repository?: {
          discussion?: {
            comments?: {
              totalCount?: number;
              nodes?: { replies?: { totalCount?: number } }[];
            };
          };
        };
      };
    };

    const comments = body.data?.repository?.discussion?.comments;
    if (!comments || typeof comments.totalCount !== "number") return null;

    /*
     * `first: 100` caps the reply tally, not the top-level count. Past 100
     * top-level comments the replies of the rest go uncounted — the number
     * would read low rather than wrong, and this is a personal site's
     * guestbook. Paginate if that ever stops being true.
     */
    const replies = (comments.nodes ?? []).reduce(
      (sum, n) => sum + (n.replies?.totalCount ?? 0),
      0,
    );
    return comments.totalCount + replies;
  } catch {
    return null;
  }
}
