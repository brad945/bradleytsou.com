# Project context for Claude Code

This file is read automatically by Claude Code when you open this folder.
It's a handoff from a chat session where the design and initial scaffold
were built — everything below is context so you don't have to re-explain it.

## What this is

Bradley's personal site, deliberately NOT a generic hover/scroll-animation
portfolio. It's structured like a Steam profile page, but every stat on it
is real, not decorative:
- Profile header = real "about me" info (name, location, current focus)
  plus a Level circle and "Years of Experience" card. These are two
  different numbers now, as they are on Steam, where level comes from
  badge XP and has nothing to do with account age. Years of Experience is
  derived from `profile.codingSince` and picks its own badge art.
  **`profileLevel` (26) is hand-set** — nothing derives or checks it, so
  it joins `codingSince` and the badge dates on the list of values that
  can't self-correct. Bradley asked for it directly
- Favorite Game = Steam's own slot, holding an actual game (CS2), with
  live hours from Steam's Web API and Valve's own logo for the tile.
  **It replaced Favorite Project**, which held DevEval — already the first
  row of Experience & Projects, so the panel restated what the page had
  just said. It carried two more lines and both were cut at Bradley's
  request: a "live from Steam" tag in the panel bar, which captioned the
  numbers with the fact that they're fetched — the claim the whole site is
  built to make without saying, so labelling it in one panel implied the
  others weren't — and a "Valve · 2023" line under the name, which stated
  who made the game rather than anything about him. `studio` and
  `released` went with it
- **Item Showcase is gone.** It was projects as an inventory grid with
  rarity-tiered tiles. Removed at Bradley's request, and with it the
  `#showcase-heading` anchor, `rarityStyles`/`rarityLabels`/`monogram`
  and the `rarity` colour tokens. The `rarity` field survives on each
  project, rendered by nothing — see `profile-data`
- Recent Activity = one GitHub block of compact rows, the three repos
  Bradley pushed to most recently, each showing name, language and how
  long ago it was pushed. Plus
  a dashed placeholder naming the sources that aren't built. **Every
  commit count here is gone** at Bradley's request — the per-row total,
  the "commits past 2 weeks" strip, and the panel-bar sum that was the
  analogue of Steam's hours-past-2-weeks. The data layer still fetches
  them, so putting any of it back is a render change only. A CS2-style
  killfeed lived here and was removed for duplicating the repo rows
- Experience & Projects = roles and built things in **one** panel. They
  were two, which split the same story in half and listed UCSB and BRI
  Youth in both. Those two are kept as roles only, since that's where the
  org and dates live. **Order is manual on both lists** — rendered in
  `profile-data` array order. A newest-first date sort was added and then
  reverted within the hour: Bradley wants Crossing Hurdles below DevEval
  despite starting five months later, and that's precisely what sorting
  by date can't express. Don't re-add it. Roles are hand-maintained
  (LinkedIn has no public API); project rows pull live commits and
  language via `ghRepo`
- Right sidebar = status heading derived from the last push, stat rows
  (Repos / Hackathon Wins / Following / Gists / Contributions, plus
  Comments and Artwork-Portfolio as em-dashes because nothing counts them
  yet), then DevEval, Tech Stack, Languages and a Links row of icons.
  **No badge tiles and no stars-ranked repo list** — both removed
- Exy = Bradley's actual dog, as a controllable character. He hides
  behind the profile photo with only his tail showing; click the tail and
  he walks out from behind it, WASD or arrows move him, clicking him
  growls and shakes, Escape puts him away. Built from three phone clips
  of the real dog. See `src/components/Exy.tsx`

**The site is live at https://www.bradleytsou.com** (Vercel, `www`
primary, apex 308-redirects to it). `siteOrigin` in `profile-data` must
match whichever domain is Primary there.

Bradley's favorite games are CS2 and Valorant — that's where the future
bhop mechanic comes from. He explicitly does NOT want fake
scroll-triggered animations or decorative hover effects; every interactive
element should either be real data or a real mechanic.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind. Three runtime
dependencies — `next`, `react`, `react-dom` — and it stays that way:
`src/lib/reactions.ts` talks to Upstash over its REST API with plain
`fetch` rather than pulling in a driver.

**Almost everything here is read-only.** Server components fetch from
the GitHub API and cache the result; nothing else is stored. The single
exception is reactions, which is the one thing a visitor can *write* —
`/api/reactions` is the site's only route handler of its own, and the
Redis behind it is its only piece of state.

Versions are pinned on purpose: `next@14.2.35` / `react@18` (the App Router
API this was written against) and `tailwindcss@^3` (Tailwind v4 drops
`src/tailwind.config.ts` in favour of CSS `@theme`, which would break the token
rule below). Don't bump either without updating this file.

## Repo layout

Flattened to 8 top-level entries at Bradley's request (it was 13). All
source lives under `src/` — `app/`, `components/`, `lib/` and the Tailwind
config. `public/`, `package.json`, `package-lock.json`, `tsconfig.json`,
`next.config.mjs`, `.gitignore` and this file are the rest.

Two things moved somewhere non-obvious, so look here before recreating them:
- **PostCSS config is the `postcss` key in `package.json`**, not
  `postcss.config.mjs`. Next's own `findConfig` checks `package.json`
  first, so this is a supported location, not a hack. It carries the
  Tailwind config path.
- **`.env.example` is gone**; its contents are the "Environment" section
  at the bottom of this file.

`src/tailwind.config.ts`'s `content` globs stay **root-relative**
(`./src/**/*`). Tailwind only rebases them onto the config file's own
directory when `content.relative` is set, which it isn't — so writing
them relative to `src/` would silently match nothing and every utility
class would stop emitting.

## Current file structure

- `src/lib/profile-data.ts` — all editable content (name, projects,
  roles, GitHub username). `githubUsername` is set to `brad945`, so the live
  data layer is on. Projects are real now — every `blurb` is the repo's
  own GitHub description, copied verbatim so it can be checked.
  **The invented values are gone.** `badges` was deleted outright and
  `codingSince` is Bradley's real 2021-01-01, so nothing on the page is
  made up. Three figures are still hand-set and *cannot* self-correct,
  each deliberately: `profileLevel` (26, his real Steam level),
  `hackathonWins` (2 — Devpost has no public API) and `accountBalance`
  ($0.21, Steam chrome reproduced as a prop, not data).
  Also here now: `privacyScreen` (the "Coming soon" cover),
  `steamProfileUrl`, `linkedinUrl`, `repoDisplayNames` and `techStack`,
  which is derived from the `tags` on roles and projects rather than
  hand-kept.
  `PLACEHOLDER_GITHUB_USERNAME` is still exported as the "not configured"
  sentinel the empty states check against.
  `githubUsername` carries an explicit `: string` annotation — without it
  TypeScript infers the literal type and the placeholder comparisons
  elsewhere become "no overlap" build errors the moment it's edited.
  Until it's set the page prerenders fully static with the feed's empty
  state; once it's real the fetch appears and the route becomes ISR.
- `src/lib/github.ts` — one `getGitHubSnapshot()` call returns everything the
  page needs from three requests: user stats, public events, and owned
  repos. It also derives the 2-week event count, per-repo commit counts
  over the same window, a language breakdown, and a stars-ranked repo
  list — all from those three responses, no extra calls. Never throws:
  bad username, rate limit, or a network failure all degrade to an empty
  snapshot with an `error` string, so a placeholder username can't break
  the build or 500 the page. Reads `GITHUB_TOKEN` from the environment if
  present (raises the rate limit from 60/hr/IP to 5000/hr) but works fine
  without one. Forks and archived repos are filtered out — they'd
  dominate the "recently played" slot without saying anything.
- Recent Activity's repo list — `getRecentRepos()` in `src/lib/github.ts`,
  rendered by `FeaturedRepoRow` in `ActivityFeed`. **The panel is automatic
  again, at Bradley's request**, after a hand-kept list left it showing
  two-month-old work three times in one day. **This is not the automatic
  list that `featuredRepos` replaced**, and the difference is the whole
  reason it's allowed back: the old one read `getGitHubSnapshot`'s repos,
  i.e. public repos Bradley *owns*, so it surfaced years-old intro projects
  while missing his private work and everything he contributes to in
  someone else's org. This is the authenticated `viewer` query across all
  three affiliations, so those repos are the first thing it returns. (Watch
  for this — an `ownerAffiliations: OWNER` query hides collaborations
  entirely.) Don't "restore" curation here.
  Two filters, and the second is load-bearing: archived and forked repos
  are out, and **he must have commits in the repo**. `pushedAt` is the
  repo's last push by *anyone*, so with `ORGANIZATION_MEMBER` in the query
  a teammate's push would otherwise put an org repo on this page as
  Bradley's activity — two such repos sit at zero commits from him right
  now. What it can't filter is judgement: a push to a coursework repo
  surfaces that repo, and Bradley chose automatic knowing that. The lever is
  **`hiddenFromActivity` in `profile-data`** — a skip list, not a return to
  hand-picking. `brad945/conclave` is on it at his request: it went live by
  name the day he pushed to it, which is what an automatic panel does. The
  other private repo eligible today, `MugetsuChris/obbyberkeley`, is
  deliberately not, and it's someone else's repo.
- Featured repos — `getFeaturedRepos()` in `src/lib/github.ts`, driven by
  `featuredRepos` in `profile-data.ts`. **No longer what Recent Activity
  lists**; it's what gets fetched for the `ghRepo` lookups behind the
  Experience and Portfolio rows, and the activity panel's fallback if the
  recency query comes back empty.
  Commits are always reported as **"yours / total"**, never the repo total
  alone: on `sennaicodes/codearenamvp` that's 155 of 2,782, and quoting
  2,782 would overstate his part 18x on a page a reader can check. The
  sidebar list ranks by *his* commits, not stars, because every public repo
  he owns has zero stars.
  Private entries are named deliberately (they're hand-picked) but are
  **not linked** — a visitor gets a 404. Needs `GITHUB_TOKEN`; without one
  both blocks fall back to the public/starred lists rather than emptying.
  Don't add coursework repos to `featuredRepos`.
- `src/components/Experience.tsx` — work history in the "recently played" row
  shape, fed by `roles` in `profile-data.ts`. Transcribed verbatim from
  Bradley's LinkedIn; don't embellish it, and remember it's the only panel
  that can go stale silently since there's nothing to fetch.
- **`ContributionSummary.tsx` no longer exists.** Contributions is a
  single stat row inside `Sidebar`. A weekly bar chart lived here first;
  it showed *when* the work happened but never what it was. Fed by
  `getContributions()` in `src/lib/github.ts` — **GraphQL, so auth-only**:
  no `GITHUB_TOKEN`, no row.
  The type breakdown comes from **author-scoped search**, not from
  `contributionsCollection.total*Contributions`. Those count public
  contributions only, so for this account they report "0 pull requests"
  while search finds 6 — 442 of 452 contributions are private and the
  typed fields simply don't see them. Don't switch back to them.
  Requires **"Include private contributions on my profile"** enabled, or
  the total collapses to public activity alone (10 vs 452).

- `src/lib/deveval.ts` — live stats from Bradley's *own* product (called
  CodeArena until mid-2026; the backing repo is still `codearenamvp`, and
  `FAVORITE_REPO` / `ghRepo` must keep that name because they're API
  identifiers, not display text), not
  someone else's API. This is the block that makes "every number is
  fetched, not written" say something about him. Configured by
  `DEVEVAL_STATS_URL` (see Environment, below); the endpoint should return
  JSON with any subset of `submissions` / `matches` / `players` /
  `problems`. Unknown keys are ignored and non-finite values dropped, so
  a malformed or half-migrated response loses rows rather than rendering
  NaN. Unset, unreachable, non-OK, unparseable, or carrying no usable
  number -> returns null and the sidebar block **hides itself entirely**.
  It never invents a number. All four failure paths are verified.
- `src/components/ProfileHeader.tsx` — full-width identity block over the
  profile-background gradient: framed avatar, name, location, summary,
  and the right-hand Level circle + "Years of Experience" card. Level is
  computed from `profile.codingSince`, so it counts up on its own.
  **The avatar is `public/avatar.jpg`, not the GitHub one** — Bradley
  supplied the photo directly. It's the only thing in the header that
  isn't fetched, so it's the only one that can go stale silently:
  changing his GitHub picture no longer changes the page. The source was
  the **full-frame original**, cropped 600x600 at q90 — the centred
  square of a 1652x1576 photo, so it's almost the whole frame with all
  three faces. Earlier passes used a circular-cropped copy, where every
  framing choice traded scene against black corner nicks; the original
  ends that, and the crop is free. To tighten it, crop toward the right,
  which is where Bradley is.
  The nav's 24px chip is **still** the GitHub avatar — it's the
  signed-in-as slot and links to the GitHub profile — so the two differ
  on purpose.
  The right-hand block is matched to the reference by ratio, not by eye.
  Against the "Level" font-size: **circle diameter 1.08x**, ring 6.4% of
  the diameter, numeral 0.44x the diameter, gap 0.20x. At 34px that's
  37 / 2 / 16 / 7. The circle being roughly the *same size as the word* is
  the load-bearing part — an earlier pass at 1.29x read as obviously
  oversized. The Years of Service card is deliberately the **plain flat
  version** — a near-black panel with a bevelled rounded badge tile was
  tried and reverted at Bradley's request. Don't reintroduce it. There is deliberately **no XP bar** between the card
  and the buttons — the reference has none, and it was another meter
  without a meaningful denominator.
  The avatar frame is a **static grey band**, matched to the reference on
  three points that are easy to get wrong:
  1. **The bands are asymmetric, and thinner than they look.** Measured
     off the reference: sides are **10.6%** of the photo's width,
     top/bottom **6.1%** of its height (76px and 43.5px against a
     720x717 photo) — a 1.75 ratio. On the 169px avatar that's an 18 / 10
     band, which with the 1px bevel means `px-[17px] py-[9px]`. Both are
     percentages of the photo, so a resize means recomputing them. Equal
     padding is obviously wrong, and anything thicker stops reading as
     a frame.
  2. **The gradient is radial, not linear**, with the light source off
     the top-left. The range stays inside medium grey
     (#9a9ea4 → #4b4f55) — widened once, by request, from an earlier
     #8a8e94 → #575b61 that read nearly flat. That's about as far as it
     goes: a genuinely wide light-to-dark sweep stops reading as a
     brushed-metal frame and becomes a different object.
  3. **It's a 3D bevel, not a flat band.** Light on the top/left edges,
     dark on the bottom/right, with the photo in a sunken well below it
     (the reverse: dark top/left, light bottom/right). `frameHi` /
     `frameLo` are those two edge colours.
  The DVD logo is sized off the reference too — ~42% of the photo width.
  Here that's 69x39 (40.8%), rounded to the nearest size whose travel
  divides evenly by the step count; see the jitter note below.
  The only thing that moves or changes colour is the DVD logo bouncing
  screensaver-style inside the 150px box. It changes colour **only on
  wall contact**, like the real screensaver. `tintKeyframes()` builds
  that: with `alternate`, each axis ends an iteration against a wall,
  so hits land every 1.5s (x) and 1.7s (y), and the pattern repeats
  every 51s — the lcm of the two full there-and-back cycles. That's
  62 hits, two of them corners (25.5s and 51s) where both axes land
  at once. Each hit gets a keyframe stop carrying `steps(1)` so the
  colour holds flat until the next one instead of interpolating.
  **The x/y durations and `HIT_CYCLE` are load-bearing** — change a
  bounce duration without recomputing the lcm and the tint drifts off
  the walls. Pure CSS, no JS.
  In `DvdLogo` the glyphs are **drawn as SVG paths, not set in a font**.
  The mark's letterforms are squat and slab-heavy with tight counters;
  no webfont at any weight gets close, which is why passes that used
  `<text>` at 900 kept reading wrong however much they were nudged. Each
  D is a single `evenodd` path (outer shell then counter), `skewX(-14)`
  supplies the italic slant, and the ellipse is a thick ring the wordmark
  overlaps — at small sizes the open centre plus the VIDEO lettering is
  what reads as a disc.
  The bounce needs two nested spans (one element carries one transform
  animation) and the travel distances in the `dvd-x` / `dvd-y` keyframes
  are hard-coded against the avatar's 167px padding box and the 69x39
  logo — **resize one and you must resize the other**. The bounce runs on `steps(15, jump-none)` /
  `steps(17, jump-none)`, i.e. duration x 10, which pins it to the original
  screensaver's chunky 10fps; change a duration and you must change its
  step count to hold that framerate. Keep durations at whole tenths so
  the step count stays an integer, and keep the two sharing no common
  factor or the path visibly loops. **Travel must divide evenly by its
  step count** (98/14 = 7px, 128/16 = 8px) — a fractional step lands the
  logo on a new subpixel phase each frame, so the browser re-antialiases
  the letterforms and it visibly jitters.
  Two things make the logo actually touch the walls, and it silently
  stops short if either regresses: the timing function must be
  **`jump-none`** (the default `jump-end` emits k/n for k=0..n-1 and so
  never reaches 1, leaving it one step short), and the SVG's **viewBox
  must be cropped to the mark's ink bounds** — a 0-0-110-62 box carries
  ~4px of transparent padding under the ellipse, so the element box can
  touch a wall while the logo visibly doesn't. Recompute the viewBox if
  a glyph, the skew, or the ellipse stroke changes.
  `DvdLogo` is drawn from SVG primitives
  (skewed wordmark over an ellipse) rather than embedding the real logo
  file, and paints entirely with `currentColor` so one animated `color`
  drives it.
  **It also hosts Exy's two slots**, `#exy-den` (his tail, left edge) and
  `#exy-emerge` (where he walks out, right edge). Both are empty anchors;
  `Exy.tsx` portals into them, so this file owns only *where* he hides.
  Both must stay **before** the frame in DOM order — later siblings paint
  on top, and that's what puts the photo over him. The avatar block
  carries `z-10` so he passes in front of the bio text, and `self-start`
  so the den's `top-%` resolves against the photo rather than the
  stretched flex row.
  The header must **not** get `overflow-hidden` — it would clip the alias
  dropdown. The gradient overlay is `absolute inset-0`, so nothing spills.
- `src/components/SiteNav.tsx` — Steam's global header: dark full-width bar
  (`chrome` #171a21), wordmark left, uppercase nav items beside it,
  signed-in user + avatar right. Uppercase with tracking is wrong nearly
  everywhere else here but it's exactly what Steam's nav does, so it
  stays.
  **The wordmark is the `bt.` mark, not text** — `BtMark`, at 50x36. It
  links to `/#top`, not `/#profile`: the nav isn't sticky, so `#profile`
  already sits ~120px down and `scroll-padding-top: 64px` parked it 64px
  from the edge, scrolling the page down ~56px on every click and eating
  half the nav. `top` is a fragment the HTML spec resolves to the document
  top with no element to point at. On hover each glyph hops in turn, 110ms
  apart, once per hover — see `glyph-hop` in the Tailwind config, and note
  the transform units there are viewBox units, not pixels.
  Nav items are **Profile / About / Chat / Play / Resume**. An entry
  without an `href` renders as dim, non-clickable text, because an
  `href="#"` that silently does nothing is worse than something visibly
  unfinished. Giving an entry an href is the whole change when its section
  lands — and taking it away is the whole change when one isn't ready.
  **About is greyed out right now**, at Bradley's request: `/about` is
  built and still routable, but its reviews and inventory are placeholder
  in the wrong voice, so a live nav item would send visitors to words he
  didn't write. It's also pulled from `sitemap.ts` for the same reason —
  a crawler can't see the grey and would have indexed the placeholder
  text. Both go back in the same commit that gives the page real copy. Targets are written root-relative
  so they also work from `/play`.
  Right side: the GitHub login, the `$0.21` balance under it, and the
  avatar, all inside one `HoverNote` reading "pulled live from cashapp
  api" — **a joke, not a description**; there is no Cash App call in this
  repo.
  `scroll-behavior: smooth` plus `scroll-padding-top: 64px` on `html`
  eases to sections; both are disabled under `prefers-reduced-motion`.
- `src/components/HeaderActions.tsx` — Steam's profile action row, sat where
  Steam puts Edit Profile. Every visitor is "someone else", so it mirrors
  Steam's other-profile set rather than Edit — pared to **Message /
  More ⋯**, since mailing Bradley is the action a visitor is actually
  likely to want, and three top-level buttons made none of them read as
  primary. Follow lives inside the menu. The menu anchors to the More
  button's own `relative` span, not the row, and is right-aligned to it —
  More is the rightmost control, so a left-aligned panel would overhang
  the column.
  The ⋯ menu deliberately does NOT ape Steam's contents (Add to
  favorites, Block all communication, Report violation) — none have a
  real equivalent, and a menu of dead entries is the fake chrome this
  site avoids. Besides Follow, the items point at the machinery behind the page:
  **View source**, **View raw API response** (`api.github.com/users/:login`
  — the JSON the page is built from) and **Activity feed**
  (`github.com/:login.atom` — the raw event feed). Closes on
  Escape and outside click like NameHistory.
  A "Copy profile link" entry was tried and cut: Steam needs one because
  its profile URLs are long numeric strings, but this is one page whose
  URL is already in the address bar, so it filled a slot rather than
  earning one. Removing it also removed the clipboard code, which needed
  a focused document and so could never be verified headlessly.
- `src/components/NameHistory.tsx` — client component for the caret next to
  the name that opens Steam's alias history ("This user has also played
  as:"). Closes on Escape (returning focus to the caret) and on outside
  click. The dropdown anchors to the **caret**, not the name — the caret
  sits in its own `relative` span so that span is the containing block,
  putting the box's top-left directly under the arrow. Content comes from
  `aliases` in `src/lib/profile-data.ts` — brad945 / bradoom /
  bradleytsou / bt, real handles rather than the old placeholders.
- `src/components/FavoriteGame.tsx` + `src/lib/steam.ts` — Steam's Favorite
  Game slot with real playtime. **Renders without the numbers when there's
  no key** rather than hiding: the favourite is hand-picked and true either
  way, so hiding it would lose a real fact to protect a missing one — the
  opposite call from the DevEval block, which is only numbers and has
  nothing left without them.
  The capsule is generated from the palette, not Steam cover art, per the
  carve-out on resembling Steam.
  `lib/steam.ts` records why a key is needed at all when the profile is
  public, which is not obvious and cost a wrong diagnosis once.
- **`ItemShowcase.tsx` is deleted.** Its grid went earlier and
  `FavoriteProject` has now gone too; `FAVORITE_REPO` went with it.
  (Historical note follows.) — **exports only `FavoriteProject`
  now**; the inventory grid that was the default export is deleted.
  `FavoriteProject`
  is Steam's "Favorite Game" slot. `FAVORITE_REPO` picks which repo, and
  the matching `projects` entry is found by id == repo name lowercased.
  Its copy comes from the **live repo description**, not `profile-data` —
  the hand-written blurb had drifted to "competitive programming platform"
  while the repo itself said "evidence-first technical interviews". The
  panel bar carried a commit count and no longer does — removed at
  Bradley's request; the same figure is still on the DevEval row in
  Experience & Projects, so nothing was lost. Tags stay hand-curated; the
  API has no equivalent. Falls back to the `profile-data` entry without a
  token.
- `src/components/ActivityFeed.tsx` — Steam's Recent Activity panel,
  restructured as **one labelled GitHub source block** plus a dashed
  `PlannedSources` placeholder naming what isn't built (Spotify, YouTube,
  videogame, books — and which of those have APIs and which would be
  hand-kept, because that distinction is the site's whole premise). Rows
  are single-line: name on the left, language and relative push time on
  the right. `MAX_ROWS` is 3, sliced here rather than trimmed out of
  `featuredRepos`, which also feeds the Experience rows. Private repos
  get a Private tag instead of a link. **All commit counts were removed**
  at Bradley's request, including the panel-bar total; `myCommits` and
  `myCommitsPast2Weeks` are still fetched, so restoring any of it is a
  render change. `PublicRepoRow` is the no-token fallback.
- `src/components/Bookshelf.tsx` — the books, as an actual shelf: spines
  standing on a plank, hover lifts and lights one, click pulls it out and
  shows what it is underneath. **Not a list panel**, at Bradley's explicit
  request — a shelf is something you scan by eye and reach into.
  It's the **third source block inside Recent Activity**, beside GitHub and
  Spotify, so it has no panel chrome of its own — `ActivityFeed` supplies
  the heading and icon. Data lives in `profile-data`.
  `SourceBlock` gained a `note` prop for it, carrying "kept by hand", and
  that exists for one reason: **Books is the only source in that panel
  that isn't fetched.** Unlabelled between two live ones it would inherit
  their credibility without earning it.
  The motion is the same carve-out as Exy: nothing moves unless you point
  at it or click it, so it's an affordance rather than ambient decoration,
  and it's all `motion-safe`.
  **The shelf is real 3D, viewed head-on.** Each book is a five-faced box:
  the spine you see straight on, both covers, and a top face — the page
  block. The covers were **missing for two rounds**, which is what made
  the books read flat however the camera moved: the depth was declared and
  never drawn. `backface-visibility: hidden` on the two covers is what
  lets them need no per-book logic — each draws only while it genuinely
  faces the camera, so books left of the vanishing point show their right
  cover and books right of it show their left, and the switch lands
  exactly where it should.
  **The books stand upright at rest.** They leaned 12° forward first and
  it looked wrong for a reason worth keeping: a leaning book inside a
  square box has nothing holding it up, so the two read as separate
  objects at odds. All the depth comes from the camera instead, and a
  hovered book at -30° is then the only tilted thing in the frame — which
  is what makes it read as pulled out rather than as one leaning book
  among nine.
  **The top face is paper, not a tint of the cover.** The top of a book
  standing spine-out is its page block, and paper against a coloured spine
  is most of what reads as a solid object. The stripes run across the
  *width* because that is how pages stack — the spine's width IS the
  thickness of the stack.
  **One light, top-left**, the same source `avatar-frame` and the shelf's
  own gradients use: left-facing covers catch it, right-facing ones are
  turned away, and every shadow falls back and to the right. The shaded
  cover has to be much darker than the spine or the crease between them
  disappears and the book reads as a taper rather than a box.
  **Shadows need the wrapper element.** They lie in the floor plane, so
  they cannot live inside the button — they'd tip up off the floor with
  the book, the one thing a shadow can never do. The button rotates, the
  wrapper holds the ground. `--sh` stretches each along the depth axis as
  its book tips out.
  **The pivot is `center bottom`** — the bottom front edge, where the book
  meets the plank — so it tips out the way you'd hook a book off a shelf.
  Two sign conventions decide whether any of it works, and an earlier pass
  got both wrong:
  - CSS `rotateX` is positive toward the viewer at an element's BOTTOM, so
    tipping a book's *top* toward you is a NEGATIVE angle. Positive reads
    as the book shrinking into the shelf.
  - The top face needs `rotateX(90deg)` about its own BOTTOM edge — put it
    above the spine with `bottom-full` and hinge it there. Hinging at the
    top edge with `-90` lands it in the same place with its face pointing
    *down*, so what you see is its underside and it drops out of view the
    moment a book tips. That was the disappearing top, and it is a
    different bug from the `filter` one below with the same symptom.
  It was built on `rotateY` first, which swings books sideways rather than
  tipping them out — the geometry was checked by simulating the projection
  offscreen before the second attempt, which is the way to do this.
  `perspective` and `perspective-origin` go on the container, not per book:
  per element every book gets its own vanishing point and they look right
  alone but wrong together. The origin is **-70px, in pixels and
  negative on purpose**: the eye has to sit clear of every book top or
  their top faces collapse. A percentage put it at book-top height, where
  tops below the eye rendered as 2-4px slivers and the taller ones —
  poking *above* it — showed their underside instead. Pixels also make it
  independent of how tall the content is. Throw is 900px. Together that's
  about the 10° Bradley asked for.
  `overflow-hidden` belongs on the spine face, never the button.
  **Never put `filter` on an element carrying `preserve-3d`.** `filter`
  forces `transform-style: flat`, so it silently overrides it — a
  `hover:brightness` on the book collapsed all its faces into one plane
  and its top vanished the instant you pointed at it. The symptom reads as
  a paint bug and the cause is a one-word class; the brightening lives on
  the faces now, where flattening their own 2D children costs nothing.
  The same applies to `opacity`, `mask` and `clip-path`.
  The shelf is the `shelf` token family plus the `shelf-*` backgroundImage
  entries — material shading like `avatar-frame`, not the decorative
  gradients this site stripped out. Five steps because the box has five
  faces at different angles and the whole illusion is that they catch
  different light. It was **beige timber first and is blue now**, at
  Bradley's request: built off `hero`, the colour of the column it sits
  in, so it reads as the surround made solid rather than as a piece of
  furniture dropped onto the page.
  **Spine colours are sampled from the real covers**, cached into
  `public/books/` from Open Library's cover API — the only hex values
  outside the Tailwind config, and deliberately so: they're data about a
  physical object like `avatar.jpg` is, not a design choice. Picking from
  the palette made the shelf look like the site rather than like the
  books. `ink` is derived from each fill's relative luminance, because
  several covers are near-white and a cycled text colour vanished on them.
  Covers are **cached, not hotlinked** — they never change, and hotlinking
  would make the shelf's appearance depend on openlibrary.org being up.
  They show only in the detail view; covers on the shelf itself would mean
  every book face-out, which is a display table rather than a shelf.
  **Sizes are hashed from the title**, not random, so they're stable across
  renders and hydration — with `>>>` rather than `>>`, since a signed shift
  on a hash above 2^31 goes negative and produced 14px spines.
- `src/components/Sidebar.tsx` — the right column. **Contributions is
  labelled "this year", and the query was changed to match** — see
  `getContributions()`: the API defaults to the trailing twelve months, so
  the label alone would have described a window the number wasn't measured
  over. Hackathon Wins is hand-set at 2 (Devpost has no public API, so
  nothing on the page can check it).
  In order: a status heading derived from the last push (Currently Online
  / Recently Active /
  Currently Offline, thresholded on hours, linked to the GitHub profile
  because that's the thing being measured), then stat rows — Repos,
  Hackathon Wins, Following, Gists, Contributions, Comments, Artwork /
  Portfolio. Then DevEval, Tech Stack, Languages, Links.
  **Zero-value rows hide themselves**, and the check is live, so each
  returns on its own once the number moves. Comments and Artwork show an
  em-dash rather than 0: nothing counts them, and "0" would claim it had
  been counted.
  **Gone from here:** followers, badge tiles, the focus list, the
  stars-ranked Top Repositories list, the language bars (see "No
  decorative meters") and the LinkedIn follower count.
  Tech Stack is derived from the `tags` on roles and projects minus
  `NON_STACK_TAGS`, plus `EVIDENCED_STACK` — so nothing can appear there
  that isn't attached to real work elsewhere on the page. **Ordered by
  `STACK_ORDER`**, grouped languages -> frameworks -> AI -> infra ->
  domain, because order of appearance put Cybersecurity first and Python
  sixteenth. An unranked tag still appears, at the end — showing up
  unranked beats vanishing.
  `Java` and `Codex` in `EVIDENCED_STACK` are Bradley's own statement
  rather than evidenced in this repo, unlike the rest of that list.
  A role with `hidden: true` is off the page but **still contributes its
  tags** — Bradley's call: hiding the row hides where the work happened,
  not the skill. Those tags are the one part of the panel a reader can't
  trace to anything visible. Links is a row
  of icons; an entry with no `href` renders greyed and unlinked rather
  than pointing somewhere invented.
- `src/components/AutoRefresh.tsx` — tiny client component that calls
  `router.refresh()` on the revalidate interval so the feed actually
  ticks over for someone leaving the tab open (ISR only revalidates on a
  new request; this supplies the request). Pauses while the tab is hidden.
- `src/lib/reactions.ts` + `src/app/api/reactions/route.ts` +
  `src/components/Reactions.tsx` — emoji reactions with **no sign-in**, and
  the site's only writable state. Counts live in an Upstash Redis, so the
  total is genuinely everyone's; a number kept in `localStorage` and
  labelled "total" would be a fabricated figure, which is the rule that
  removed the decorative meters. Unconfigured or unreachable -> the panel
  **renders nothing**, same as the DevEval block; a zero would claim
  counting had happened.
  Keys are ASCII slugs, not emoji, and the server validates every slug
  against a fixed list — so a hand-written POST can't create keys. There's
  a crude per-IP ceiling (20/min) that fails **open**, because a store
  hiccup should cost a lost limit rather than a broken button.
  `localStorage` is used for one thing only: remembering which buttons
  *you* pressed, so they read as spent. That's UI state about a browser,
  which is what it's honest for. It is not the count and it is not a limit.
- `public/giscus.css` — a **custom giscus theme**, and the only way to
  change anything inside that widget: it renders in a cross-origin iframe,
  so this site's stylesheet can't reach it and `data-theme` accepting a URL
  is the entire lever. It **replaces** the theme rather than adding to one,
  so giscus's own `transparent_dark` palette is inlined before the
  overrides — refetch that file and re-append if it ever needs updating.
  Two overrides today: the reaction bar moved below the comments (flex
  `order` on `.gsc-main`'s children, since the DOM isn't reachable but the
  layout is), and "powered by giscus" hidden. That line has no class of its
  own — it's a bare `<em>` in `.gsc-left-header` — so the element type is
  the only handle.
  `Comments.tsx` builds the URL from `location.origin`, so it needs no
  per-environment config; the browser fetches it from inside the iframe.
- `src/components/Comments.tsx` — **parked again, and this time not
  because it's unfinished.** It's fully configured: repo public,
  Discussions on, giscus app installed, pinned to discussion 1 by number.
  Commenting just needs a GitHub sign-in, and Reactions is the
  sign-in-free version of the same idea, so it went first. Uncomment two
  lines in `page.tsx` to bring it back; nothing else needs changing.
  Uses giscus (GitHub Discussions-backed, not a fake widget). **Blocked on
  the repo being public** — giscus requires it, and as of now
  `brad945/bradleytsou.com` is private with Discussions disabled. Then:
  enable Discussions, install the giscus app, paste `data-repo-id` and
  `data-category-id` into `GISCUS`, uncomment two lines in `page.tsx`.
  Making the repo public also lights up "View source" in the ⋯ menu by
  itself.
- `src/components/Exy.tsx` — Bradley's dog as a controllable character,
  and the biggest thing here. Asleep he's portalled into `#exy-den`
  behind the avatar with only his tail out; clicking it plays a growl and
  starts an `emerging` phase parented to `#exy-emerge` on the photo's
  other edge, where CSS walks him out from behind it before handing off
  to the free-walking layer. Then WASD **or arrows** move him, clicking
  him growls and shakes, Escape puts him away (clicking no longer does).
  Load-bearing details, all with their reasoning in the file: speeds are
  per-axis and multiplied by his scale; he grows walking down and shrinks
  walking up, but only when the vertical key is held alone; the side
  frame rate is *derived* from speed so his feet don't slide; he's drawn
  twice a viewport apart so the horizontal wrap is seamless; vertical
  clamps rather than wraps.
  Frames were cut from three phone clips with ffmpeg + rembg — see
  `public/exy/README.md`, which records the pipeline and the two things
  still missing (a back cycle, and a real bark; `growl.mp3` stands in).
- `src/components/BtMark.tsx` — the `bt.` mark as vector primitives,
  shared by the favicon and the nav. viewBox is the mark's exact ink
  bounds (408x292), and the b's counter is a real hole done by winding.
  Passing `glyphClassName` wraps each glyph in its own `<g>` for
  animating; **omitting it leaves the markup ungrouped, and that path is
  the one Satori renders** — Satori cannot handle React Fragments, so the
  component has two whole returns rather than shared structure.
- `src/components/AnimatedFavicon.tsx` — swaps the static `/icon` for a
  four-frame stepped hop after hydration. Whole-pixel offsets on purpose:
  sub-pixel positions blur at 16px, and browsers coalesce favicon writes,
  so raising the frame rate does nothing. Chrome repaints tab icons about
  once a second, which is the hard ceiling on this.
- `src/components/HoverNote.tsx` — an instant hover note, because native
  `title` has a ~1s delay nothing can shorten. `w-max` and the *named*
  group are both load-bearing; see the file.
- `src/components/BoardedUp.tsx` — the "Coming soon" cover, rendered
  **instead of** the profile grid when `privacyScreen` is on. An overlay
  was tried and couldn't hold: covering pixels doesn't disable a document.
- `src/components/SocialIcons.tsx` — the Links row marks, drawn as paths
  rather than pulled from an icon package.
- `src/app/play/page.tsx` — `/play`, deliberately near-empty. It exists so
  the nav's Play item can be a real link. It fetches the snapshot for one
  reason: `SiteNav` hides its whole right-hand block when `stats` is null,
  so without it the nav there would be visibly shorter.
- `src/app/icon.tsx`, `opengraph-image.tsx` — the favicon and the 1200x630
  share card, both generated at build time from `profile-data` rather than
  checked in as binaries.
- `src/app/robots.ts`, `sitemap.ts` — allow-all plus the sitemap. Two
  URLs, `/` and `/play`; `/about` is deliberately absent while its nav
  item is greyed out. `lastModified` is deliberately omitted: content changes when
  Bradley commits, not when Vercel rebuilds.
- `src/app/page.tsx` — SiteNav, full-width ProfileHeader, then a
  `lg:grid-cols-[2fr_1fr]` split that stacks below `lg`. `max-w-profile`
  is **990px**, not Steam's 940 — widened 25px per side at Bradley's
  request for more text room, so the columns land at ~649 / 12 / ~325
  (the gap is Steam's 12px `.profile_customization` margin). The 2:1
  ratio is Steam's; the absolute widths are no longer. `<main>` carries
  `hero`, which is what makes it read as the centred column.

  **The grid was flattened to a single column once and put back.** "One
  column" meant the *page* — this centred `max-w-profile` block on the
  grey surround — not the main/sidebar split inside it. Don't collapse it
  again.

  Main column order: **Recent Activity, Experience, Favorite Game**.
  Contributions moved to the sidebar. Comments import is commented out on
  purpose; `<Exy />` sits outside the column, since he walks the whole
  viewport rather than the centred block.
- `src/app/layout.tsx` — fonts (next/font), metadata, `metadataBase` and
  the canonical, and the fixed starfield layer. The nebula glow went with
  the rest of the decorative gradients; the starfield is 12
  radial-gradients each painting a single 1px dot. Mounts
  `<AnimatedFavicon />`.
  **Three fonts, not two.** Open Sans (display + body), JetBrains Mono
  (`.label` chrome only), and **Gabarito** as `--font-sign`, used by
  exactly one element: the "Coming soon" line. It's a free stand-in for BB
  Casual Pro Medium, which Bradley asked for and the site cannot load —
  Bold Studio sells it per-licence and embedding needs a paid webfont
  licence, the same wall as Motiva Sans.

## Design tokens (already in tailwind.config.ts)

**Dark theme**, and the palette is Steam's own, taken from their
stylesheets — `#171d25` is `#global_header`, `#8f98a0` their body text,
`#66c0f4` their link blue, `#c7d5e0` their bright text.

**Two different Steam surfaces, don't mix them up.** `#1b2838` is `body`
in `globalv2.css` — the *community/store* page. Profile pages use
`body.profile_page { background-color: #000000 }`. So `base` (the page)
is black and `hero` (the centred column, on `<main>`) is the blue.
Painting the whole page #1b2838 was tried and reverted: with no darker
surround there is no column to see.

The panel fills are derived, not guessed: Steam paints profile cards
`rgba(0,0,0,.3)` and status blocks `rgba(0,0,0,.5)` over the page, so
`panel`/`panel2` are those composited over `#1b2838`, and `line` is their
`rgba(255,255,255,.1)` border done the same way.

**A light theme was built and reverted** (commits `41c4d3a`, `f8903e8`,
undone here). If it's ever wanted again the values were: `base` #c2c7ce,
`hero` #eaedf1, `panel` #dfe3e9, `panel2` #d2d7de, `line` #aeb6c1,
`chrome` #d9dde3, `bright` #0e1723, `ink` #1f2a36, `copy` #3b4856,
`muted` #616b76, `accent` #945e09, `live` #12784a, `link` #0f5f96, and
the starfield dots as `rgba(30,45,66,…)`.

**The bio lines are white now**, so the theme-swap legibility problem the
accents used to have is moot while they stay unused.

- `base` #000000 (page), `hero` #1b2838 (the centred column)
- `panel` #131c27, `panel2` #0e141c, `line` #323e4c
- Text ramp: `bright` #ffffff (headings), `ink` #e5e8ea, `copy` #c7d5e0
  (body), `muted` #8f98a0
- **Links are `ink` at rest and `link` blue on hover** (`.steam-link`), which
  is the reverse of Steam. Steam runs blue at rest because its pages are
  dense with links; here a link is usually a proper noun inside a sentence,
  so blue at rest tinted half the page. Blue now means "under your pointer"
- `accent` #de9b35, `live` #5cc98f, `link` #66c0f4
- `chrome` #171a21 (global header), `teal` #2a475e (panel bars)
- `steel` #8e9199 (avatar frame band), `menu` #464c58 (alias dropdown)
- **Bio-line accents, on the org links only**: `berkeley` #dca009,
  `medimpact` #b771f4, `deveval` #60ebdb. The bio sentences are `bright`
  white and each org **link** carries its colour, so the hue marks the word
  it belongs to instead of tinting a whole line. They've been on the full
  sentence and off entirely before this; the config comment carries the
  reasoning behind the values.
  Three things worth not relearning if they return: gold is the one brand
  colour usable raw here (Berkeley Blue #003262 is 1.16:1 on this column,
  MedImpact's #250644 is 1.18:1 — both had to be tints); MedImpact is the
  contrast risk at 5.59:1, and L=66 fails outright; and "more teal" means
  more saturated and slightly darker, **not bluer** — 180 is cyan. The
  trap is re-harmonising all three to a shared saturation, which is what
  read as highlighters at 60/65/76%.
- Fonts: Open Sans (display + body), JetBrains Mono (`.label` chrome
  only), Gabarito (`font-sign`, the "Coming soon" line and nothing else)

## Typography

Steam's own face is **Motiva Sans** (Typotheque, licensed — not on Google
Fonts and not bundleable). It now leads the `display` and `body` stacks in
`src/tailwind.config.ts`, so a visitor who already owns and has installed
it sees it — but **the site does not and cannot load it**. Self-hosting
the file needs a paid Typotheque webfont licence. Don't "fix" this by
adding an @font-face pointing at a copied file.

**Open Sans** is therefore what renders for essentially everyone. Bradley
picked it over Mulish (the previous substitute), Nunito Sans, Source
Sans 3, IBM Plex Sans and Inter, from a side-by-side of all six set in
this page's own headings at its own sizes.

**Open Sans has no 200 weight** — the family starts at 300. Steam's
headings are weight 200, so every `font-extralight` here became
`font-light`; the CSS states the weight that actually renders instead of
asking for one that silently clamps. Don't "restore" 200.

The scale lives as `.t-*` classes in `src/app/globals.css` and is taken
**from Steam's own `profilev2.css`**, not estimated off screenshots:
persona name 24/200/lh40, panel header 16/200/lh30, stat 24/200, big stat
34/200, label 14, body 13. The eyeballed values it replaced ran 17-41%
large and about double the weight on headings. Check their stylesheet
before changing any of these. Four traits carry most
of the resemblance, and all four are easy to lose:
- **very light weights** (200-300) on anything large — sidebar counts and
  the showcase counter are weight 200, the persona name 300
- **no letter-spacing and no uppercase** outside the tiny mono `.label`
  used for chrome labels. Tracked uppercase is the single most un-Steam
  thing you can add
- **pure white for headings, blue-grey for copy** — not one flat colour
- **tight leading on headings, ~1.5 on body**

Measured against Steam and matched: the global header is **104px**
(`#global_header .content`), panels carry a **3px** radius
(`.profile_customization`) and sit **12px** apart (its `margin-bottom`).
The profile header's 230px is already within 6px of Steam's 224px
`min-height`.

One place we deliberately differ: our panel bar is 46px where Steam's
`.profile_customization_header` computes to 40 (5px padding + 30px
line-height). Bradley asked for bigger, so it stays bigger.

`.panel-bar-title` / `.panel-bar-meta` / `.stat-label` / `.stat-value`
are aliases onto that scale, so restyling the scale restyles the page.

**No gradients.** Every decorative gradient was removed — the page glow,
the profile-hero sweep, the teal-to-purple panel bars, the panel sheen and
the xp fill are all gone, replaced by flat fills (`hero`, `teal/60`).
Two things under `backgroundImage` survive and neither is decoration:
`starfield` (12 radial-gradients that each paint a single 1px dot) and
`avatar-frame` (material shading — the reference frame is genuinely lit
from the top-left, and flattening it makes the bevel vanish). Don't add
new ones.
Reusable Steam-shaped classes (`.panel`, `.panel-bar`, `.stat-row`,
`.steam-link`, `.steam-button`) live in `src/app/globals.css`.

## The solids — every box on this page has thickness

The page is 3D. Every element that already read as a box — panels, title
bars, the avatar frame, buttons, menus, chips, tiles — is now a solid with
two visible walls, and it stands up off the page when you point at it.
Everything that was *not* a box stays flat: the blue column, the nav bar,
the bio lines, the footer. Bradley asked for this directly, and the
sentence that governs every decision below is his: **"do not change how
anything looks visually"** — pull the 2D page into 3D and leave the blank
space 2D.

The system is `.solid` in `src/app/globals.css`, where the geometry and
the reasoning are written out in full. The short version:

**It is drawn, not filmed, and the constraint is what picked that.** A
perspective camera — CSS `perspective`, three.js, any of it — magnifies a
face as it comes toward the viewer. A panel 10px proud of the page under
`perspective: 1800px` renders 0.8% larger and a few pixels further from
the vanishing point, so every panel edge and every line of type inside it
moves. **Oblique projection** is the one projection where the front plane
is parallel to the picture plane and therefore projects at exactly 1:1.
The faces are untouched *by construction*, which is also why there is no
JS, nothing to recompute on resize, and nothing to re-sync on scroll.

**three.js was considered and is not used.** It is already a dependency —
`/play` runs a react-three-fiber scene — so this is not about adding one.
Putting the profile in WebGL would mean rasterising live text, links, Exy
and the giscus iframe into textures: it loses selectable text, the
accessibility tree, and every one of those features, to render something
that by definition can't match the page it replaced. `CSS3DRenderer`
doesn't help — it reparents each element to the renderer's container, so
`section`/`h2` nesting is gone. The honest third option is a WebGL canvas
*behind* the DOM drawing only the walls, with the camera matched to the
layout; it is real work for a seam that CSS doesn't have, and at these
depths (3-10px) perspective convergence across a wall is sub-pixel, so it
would look identical. `/` ships 106 kB of JS; `/play`, with three in it,
ships 367 kB.

**The depth axis runs 45° to the bottom-right**, so a box shows its right
wall and its underside. Not arbitrary: this site lights everything from
the top-left (`avatar-frame`, the bookshelf's five faces), and those are
the two faces that should be in shadow. The walls are `solidSide` /
`solidFoot` — black at low alpha over whatever is behind the box, the same
derivation Steam uses for the panel fills themselves, which is why one
pair of values is right on every material here.

**Depths, and why each is what it is.** A nested solid must be shallower
than the whitespace under it, or its walls land on content:

| What | Depth | The clearance that sets it |
| --- | --- | --- |
| `.panel` | 10px | 12px between panels (`gap-3`), 16px in the sidebar |
| `.solid` default | 6px | tiles and cards inside a panel's `p-5` |
| `.panel-bar`, `.solid-thin` | 3px | Experience's body is `pt-1` — 4px under the bar |
| `.steam-button` | 4px | `gap-2` between Message and More |

**On hover the face slides up the depth axis and the walls grow with it**,
so the base stays planted and the box reads as standing up rather than
sliding. `--lift-on` is the lift as a fraction of the depth — 0.5, and 0.4
on panels, which are big enough that more heaved the column as the pointer
crossed it. **Its product with the depth has to be a whole number of
pixels**: the lifted face carries text, and a face parked on a fractional
offset gets re-antialiased there. (That's the third time this has come up
here, after the DVD logo's travel and the favicon's frames.) The easing
overshoots, and that overshoot is the bounce. Five rules hold it together,
each with the symptom it prevents:

- **Only the innermost box moves.** `:has()` reads that; `.solid-stop`
  marks a region that suppresses its ancestors without being a solid
  itself. Without it, pointing at one chip heaves the chip, its panel and
  the column at once.
- **The walls keep their pointer events**, so the lifted silhouette is a
  superset of the resting one. Without it, pointing near a box's
  bottom-right corner moves it out from under the pointer, which unhovers
  it, which drops it back — a flicker loop at the exact spot people aim
  at.
- **Nothing is transformed at rest.** A `translate(0, 0)` still creates a
  stacking context and a containing block on every panel: a rendering
  change dressed as a no-op.
- **No lift on a touch screen** (`hover: hover` and `pointer: fine`) and
  none under `prefers-reduced-motion`, which sets `--lift-on: 0`. The
  walls stay in both cases — a box having sides is not motion.
- **A solid must not carry a `transition-*` utility.** Utilities land in a
  later layer and replace `transition-property: transform` outright, so
  the face snaps to its lifted position while the walls still grow over
  260ms — the base coming off the page, which is the one thing the lift is
  built not to do. The sidebar's stat link had `transition-colors` and did
  exactly that; it was animating nothing, since the hover colour is on the
  label through `group-hover/stat`.

**The panel bar is the one solid that doesn't lift.** It has walls, but it
is absent from every hover selector, so pointing at a title bar raises the
panel it's printed on — which is what it is. In the lift system it was a
dead strip across the top of every panel instead.

**What is deliberately flat, and don't "fix" it:**

- **The nav bar and the centred column.** Both are full-bleed at some
  width, so a wall would project past the viewport and add horizontal
  scroll. They're also the right things to be flat: the column is the
  surface the panels stick out *of*.
- **Round boxes** — the Level ring and the parked Reactions pills. The
  walls are rectangles butted against the face's edges; on a circle they
  stick out as square tabs. The ring is also hollow, so an offset copy
  fills its middle with a dark disc behind the numeral.
- **The photo well inside the avatar frame.** It's a recess, not a box.
- **The bookshelf, the giscus iframe and `/play`'s 3D canvas**
  (`.solid-stop`). The shelf and the model were already 3D and have their
  own motion — the model is dragged to rotate, so the panel behind it
  would have lifted under the drag. giscus is someone else's document.
- **Valve's Years of Service badge.** The PNG has an alpha channel, so a
  wall on its bounding box would hang off the art. The CS2 logo is opaque
  and does get one.

**Two traps worth not relearning.** `--bw` exists because percentages on
an absolutely positioned child resolve against the *padding* box: on a
bordered box, `left: 100%` lands one pixel inside the border and the wall
paints over the edge it is meant to start from — hence `.solid-edged`.
And a child flush with its parent's right edge gets no right wall
(`.panel-bar`, `.solid-foot`), or it draws a bar wider than the box it
sits on.

**How to prove a change here didn't alter the page.** Screenshot the page,
then — *in the same render* — inject `content: none` on the walls and
screenshot again; two page loads would differ anyway, because the times
are relative and the rows are live. Every changed pixel must fall inside
an expected wall quad, which you can compute from each solid's
`getBoundingClientRect()` and its `--depth`. That run is what this was
landed on: 81 solids on `/`, 14 on `/about`, zero changed pixels outside a
wall.

**The rarity tokens are gone**, along with `nebula`, `plum` and `wine`.
The first three fed only the deleted Item Showcase; `plum` and `wine` were
never referenced at all, shadowed by `teal` and `chrome`. If tiers ever
come back they were `accent` / `nebula #417a9b` / `muted`.

Class strings built by concatenation are still the trap that made those
written out in full — **Tailwind's scanner reads source as text**, so it
can't see a name assembled at runtime. It also reads *comments*: writing
an arbitrary-value class inside one emits it as a real, dead rule. That
has happened twice.

- `src/app/about/page.tsx` + `src/lib/about-data.ts` + `Reviews.tsx` /
  `Inventory.tsx` / `Achievements.tsx` — **`/about`, the personal half.**
  `/` is the formal one; this is what he does, likes and plays.
  The idea, and the reason it isn't prose: it's built out of **the Steam
  surfaces the profile page didn't claim** — Reviews, Inventory,
  Achievements. The profile earns its credibility by being all data, and a
  wall of "I'm passionate about…" on the same site would break that spell,
  so everything personal goes in a Steam-shaped container.
  The CS2 review's hours are **fetched, not written** — a review carrying
  an invented figure while the Favorite Game panel two clicks away carried
  a fetched one is the exact failure everything else here guards against.
  Any review with an `appId` gets live hours; the rest keep their strings.
  **Reviews and Inventory are otherwise placeholder** and marked `TODO(bradley)`;
  the achievements are real, each drawn from something already in
  `profile-data`. Review hours are free text on purpose, so an estimate can
  carry its own tilde — a number would launder a guess into a measurement.
  No rarity percentages on achievements: Steam's are measured, ours could
  only be invented, and an invented percentage beside real dates poisons
  both.
  `rarity` renders again here, answering a different question than it did
  on the showcase — how much of his life a thing takes up, not how central
  it is to his work.
  One column, not the profile's 2fr/1fr: these panels are dense and there's
  no live sidebar data that belongs beside them.

  **Parked ideas for this page, not yet built:** his Steam profile is
  already funny (location "Luxemburg, Luxembourg, Luxembourg", real name
  "Bradley Butt", persona `BigBunzBrad700`) and pulling that live would be
  both real data and a joke; and `algebradley` in `aliases` deserves a
  panel explaining where each name came from.

## Explicitly NOT built yet — do these next, in this order

**Exy is done** and is no longer on this list.

1. **A unified activity page, and re-point "All Activity" at it.**
   Bradley's, and the reason Recent Activity's footer was removed rather
   than left pointing at GitHub.

   One page listing **everything in chronological order**, sources
   interleaved — a GitHub push, a Spotify track and a book finished all on
   the same line, ordered by time and not grouped by which app they came
   from. That's the opposite view of the panel on `/`, which groups by
   source because each block is a different shape; this one drops the
   grouping entirely and keeps only the order.

   Opens as a pop-up / separate page rather than navigating away. Until it
   exists there is nothing to link to, which is why the footer is gone
   instead of repointed — a row of links to someone else's site is the
   wrong placeholder for a page about this one. The removed markup and its
   reasoning are in `ActivityFeed.tsx` where the footer used to be.

2. **Spotify "now playing".** Show the track currently playing when there
   is one, falling back to recently-played when there isn't — labelled
   distinctly, because "playing now" and "played 20m ago" are different
   claims and this site doesn't blur those.

   **The blocker is a scope, not code.** The refresh token in
   `SPOTIFY_REFRESH_TOKEN` was minted with `user-read-recently-played`
   alone, and Spotify issues scopes at authorization time — so
   `/me/player/currently-playing` and `/me/player` both return
   `401 "Permissions missing"` and no code change can fix that. Verified
   directly, not inferred from docs.

   Bradley has to re-authorize once, adding
   `user-read-currently-playing` (and `user-read-playback-state` if the
   device/volume detail is ever wanted). The new refresh token then goes
   in `.env.local` **and in Vercel** — the old one keeps working for
   recently-played either way, so nothing breaks while this waits.

   Note the polling cost before building it: `revalidate` on the page is
   60s, and a "now playing" row is only honest if it's at least that
   fresh.

3. **Wire up Comments.tsx.** *(Historical note: this used to say the
   blocker was that giscus needs a public repo. The repo is public now,
   Discussions are on, the app is installed and it's pinned to discussion
   1 — the code is finished and configured.)* It's **parked**, because
   commenting needs a GitHub sign-in and Reactions is the sign-in-free
   version of the same idea. Uncomment two lines in `page.tsx` to bring it
   back; nothing else needs changing.
4. **Bhop/strafe-timing canvas** as an entry gate before the page reveals.
   Real skill-based mechanic (WASD + jump timing / simple physics), not a
   decorative loading animation. Should have a skip option — don't hard-gate
   the site behind it. `/play` exists and is empty, so it has a home now.
5. **Radar-style "about me" map** — a custom map-like layout (doesn't need
   to be a literal CS2 map, can be styled abstractly) where pins are skill
   categories. Clicking a pin opens a loadout-card style panel. Note it was
   going to reuse the Item Showcase's rarity visual language, and that is
   deleted — the `rarity` field on each project survives as its input.

### Waiting on Bradley, not on code

- A **Discord URL** (last greyed icon in the Links row) and a **resume
  PDF** in `public/` (the nav item lights up on its own once its href is
  filled in).
- **Bio copy.** The `Bio` heading is on the page with nothing under it,
  and it's also what would let the About nav item become a real link.
- **Exy's back cycle and a real bark** — see `public/exy/README.md`.

## Deployment — already done

**Live at https://www.bradleytsou.com**, on Vercel, from
`brad945/bradleytsou.com` — **public**, and note the repo was renamed from
`bradleytsou-site`. GitHub 301s the old name so git and the API never
noticed; giscus did, because it resolves `data-repo` literally. If it's
renamed again, `SITE_REPO_NAME` in `profile-data` is the fix. `www` is Primary and the apex
308-redirects to it; `siteOrigin` in `profile-data` is hardcoded to match
and **must be changed if that's ever flipped**, or every canonical points
at a URL that redirects.

`npm run dev` serves on **port 3003**, not 3000.

`GITHUB_TOKEN` needs to be set in Vercel's environment variables, not
just locally — without it the status line, contributions, languages and
every featured-repo row degrade to their empty states.

**The "Coming soon" cover is `privacyScreen` in `profile-data`, and it is
currently `false` on this branch.** Pushing takes the cover down. That is
a one-word edit either way, but it isn't obvious from a diff summary, so
check it before pushing.

## No decorative meters

Two progress bars were removed for the same reason and the rule now stands:
**a bar needs a denominator that means something.** Both the repo-row bar
(scaled against whichever featured repo was busiest) and the sidebar
language bars (scaled against the most-used language) were shapes that
looked like progress while measuring nothing — decoration dressed as data,
which is exactly what this site exists not to do. Both are plain numbers now.

The one surviving bar is the XP fill under Years of Service, because "90%
to 7" is a real fraction of a real year. Apply that test to any new meter.

## Things to avoid

- No fake/decorative animations — every interactive element should be real
  data or a real mechanic, per Bradley's explicit brief. Two deliberate
  exceptions, both replications of actual Steam features Bradley asked
  for: the animated avatar frame (DVD-screensaver bounce) and the status
  pulse. Neither is scroll-triggered and neither is a hover effect. Don't
  read these as licence to add decorative motion elsewhere.
  A third was added and removed within the hour — `cal-swap`, the tagline
  cycling Berkeley Blue to California Gold. It was the only one that was
  decoration rather than a real feature, and it went.
  **Four more have since been added, all at Bradley's explicit request
  after the rule was put to him:** Exy's tail wagging where it pokes out
  from behind the photo (idle slow, faster on hover), the `bt.` mark's
  per-glyph hop on hover, Exy's shake when clicked, and the reaction
  emoji flying up the screen. Every one of them except the idle wag fires
  only in response to a click or a hover, which is the line that keeps
  them out of the "scroll-triggered decoration" the brief bans. All are
  `motion-safe`, and the flying emoji don't spawn at all under
  `prefers-reduced-motion`. The rule still stands — don't read these as
  licence.
  **A fifth, and the largest: the solids' hover bounce**, asked for by
  name in the same message that asked for the page to be 3D. It lands on
  the right side of the same line — nothing moves until it is pointed at,
  and the lift is off entirely under `prefers-reduced-motion` and on
  touch screens. See "The solids" above.
- **Close visual fidelity to Steam's profile layout is intentional** —
  Bradley asked for it directly, superseding the earlier "inspired by the
  structure of, not a literal skin" note. Don't undo it. The carve-out
  that still holds: no Valve logo or wordmark, no game capsule art, and
  every capsule and frame on this site is generated from the palette.
  Keep the footer's "not affiliated" line.
  **Two deliberate exceptions, both at Bradley's explicit request after
  the tradeoff was put to him, and they are the only Valve-owned assets
  here:**
  1. `public/steam-years-*.png` — Valve's real Years of Service badges,
     served for the card in `ProfileHeader`. Keyed off `level` rather than
     hardcoded, so the art tracks the number beside it; years past
     `STEAM_BADGE_YEARS` fall back to the generated tile.
  2. `public/cs2-logo.png` — Valve's CS2 mark, in the Favorite Game slot.
     Bradley supplied the file himself. It replaced a generated "CS2" text
     tile. The narrower half of the rule above still holds: this is the
     game's logo, **not** a store capsule, so "no capsule art" is intact.
     No border on it — its gold lands within a few points of `accent`, so
     a frame only fought the artwork.
  Neither is licence for more. The pattern is that each one was asked for
  by name; nothing here generalises into permission for other Valve art.
- Don't hardcode colors outside the token system in `src/tailwind.config.ts`.

## Environment

Both optional; this was `.env.example` before the repo was flattened. Put
real values in `.env.local`, which `.gitignore` already covers.

```sh
# Optional. Without it the Favorite Game panel still renders, minus the
# hours — it never invents them. Free and instant from
# https://steamcommunity.com/dev/apikey
#
# A key is needed even though the profile is public: Steam closed the
# key-free games list (steamcommunity.com/.../games?xml=1 now redirects
# everyone to sign-in) and api.steampowered.com 401s without one. The
# account's "Game details" must also be Public, or the API returns an
# empty response.
STEAM_API_KEY=

# Optional, but reactions need BOTH or the panel hides itself entirely.
# Create a free Upstash Redis (Vercel → Storage → Upstash, or upstash.com)
# and copy its REST url and token. Nothing else uses these.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional. Raises the GitHub API rate limit from 60/hr/IP to 5000/hr.
# A fine-grained PAT with no scopes is enough — it only needs to be valid.
GITHUB_TOKEN=

# Optional. Points the sidebar's DevEval block at your own API.
# Expects JSON with any subset of these keys; unknown keys are ignored and
# non-numeric values are dropped:
#   { "submissions": 1204, "matches": 318, "players": 96, "problems": 42 }
# Unset, unreachable, or unusable -> the block hides itself. It never
# invents a number.
DEVEVAL_STATS_URL=
```

Without `GITHUB_TOKEN` the status line, contributions, languages and every
featured-repo row degrade to their empty states — the page still builds.
It is needed in Vercel's environment variables too, not just locally.
