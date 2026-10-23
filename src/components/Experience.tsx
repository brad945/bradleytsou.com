import type { FeaturedRepo } from "@/lib/github";
import { roles, type Role } from "@/lib/profile-data";

/**
 * Work history.
 *
 * **The projects moved out**, to a Portfolio panel on `/about`, at Bradley's
 * request. This was one merged panel for a while and the merge was right at
 * the time — the split it replaced listed UCSB and BRI Youth in both halves.
 * What's left is roles only, which is what the heading now says.
 *
 * They were two panels and split the same story in half — where he worked
 * versus what he built — with UCSB and BRI Youth appearing in both. Merged,
 * and the duplicated entries were folded together rather than dropped: what
 * the standalone project rows carried (the tags, the framing) now lives on the
 * role, so one entry holds everything known about it.
 *
 * Order is manual on both lists, not sorted: Bradley wants MedImpact above
 * Crossing Hurdles even though it started a month earlier, so sorting by date
 * would fight him.
 */
export function Row({
  title,
  meta,
  subtitle,
  blurb,
  tags,
  href,
  isPrivate = false,
  award,
  metaSub,
}: {
  title: string;
  meta: string;
  /** Sits under `meta`, right-aligned with it. A role's location goes here. */
  metaSub?: string;
  subtitle?: string;
  blurb?: string;
  tags?: string[];
  href?: string;
  /** Shows a Private tag. Set when the backing repo isn't publicly visible. */
  isPrivate?: boolean;
  /** Short award chip beside the title, e.g. a hackathon win. */
  award?: string;
}) {
  return (
    /* The hairline stays on the `li` and the box is the `div`, which stands
       8px wider than it on each side — see the row inset in globals.css. A
       border on the box itself would widen with it. */
    <li className="border-t border-line/50">
      <div className="solid-hover flex flex-col gap-x-6 gap-y-1 py-3 sm:flex-row">
        <div className="min-w-0 sm:w-[190px] sm:shrink-0">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="steam-link text-[15px]"
            >
              {title}
            </a>
          ) : (
            <span className="text-[15px] text-copy">{title}</span>
          )}
          {/*
            Marks a project whose repo a visitor can't open. It's shown instead
            of a link rather than beside one — the point is that there's nothing
            to click, not that the link is restricted.
          */}
          {isPrivate && (
            <span className="solid solid-thin solid-edged ml-2 border border-line px-1.5 py-px text-[10px] uppercase tracking-wider text-muted">
              Private
            </span>
          )}
          {/*
            Accent gold, and the only chip on either page that is. Private is
            `line`/`muted` because it marks an absence — nothing to click — and
            this marks the opposite, so borrowing that styling would have made a
            prize look like a restriction.

            On its own line under the title, at Bradley's request. `flex w-fit`
            rather than `inline-block`, and that's the part that matters: the
            title is an `<a>`, so an inline-block chip after it simply shares its
            line whenever there's room. It needs to be block-level to sit under
            anything, and `w-fit` keeps it hugging its text instead of spanning
            the 190px column.
          */}
          {award && (
            <span className="solid solid-thin solid-edged mt-1 flex w-fit whitespace-nowrap border border-accent/60 px-1.5 py-px text-[10px] uppercase tracking-wider text-accent">
              {award}
            </span>
          )}
          {subtitle && <p className="t-meta mt-0.5 leading-snug">{subtitle}</p>}
      </div>

      <div className="min-w-0 flex-1">
        {blurb && <p className="t-meta leading-snug">{blurb}</p>}
        {tags && tags.length > 0 && (
          <p className="mt-1 font-mono text-[10px] text-muted/60">
            {tags.join(" · ")}
          </p>
        )}
      </div>

      {/*
        Dates for a role, period + language for a project. The commit count
        that used to sit under this was removed at Bradley's request — the
        `stat` slot went with it rather than being left empty, since an unused
        prop reads as something that broke.
      */}
      <div className="t-meta shrink-0 leading-snug sm:w-[150px] sm:text-right">
        {/*
          `whitespace-nowrap`, and the column widened from 132px to hold it. At
          13px the longest range ("May 2026 — Aug 2026") measures ~126px, so it
          sat inside 132 by a few pixels and broke after the em dash on the
          narrower end of that margin — a date range split across two lines
          reads as two dates. Nowrap alone would have overflowed left into the
          blurb, so the width is the other half of the fix.
        */}
        <p className="whitespace-nowrap">{meta}</p>
        {/*
          The location, under the date rather than beside the job title, at
          Bradley's request. It groups the two facts that answer "when and
          where" in one column and leaves the left column to the role itself.

          Not nowrap: the date above is a known width, but a location is
          arbitrary text, so a long one should wrap inside the column instead
          of overflowing left into the blurb.
        */}
        {metaSub && <p className="text-muted/70">{metaSub}</p>}
        </div>
      </div>
    </li>
  );
}

function roleRow(role: Role, repo?: FeaturedRepo) {
  return (
    <Row
      key={`role-${role.org}-${role.title}`}
      title={role.org}
      href={role.url}
      subtitle={role.title}
      blurb={role.blurb}
      tags={role.tags}
      meta={`${role.start} — ${role.end ?? "Present"}`}
      metaSub={role.location}
    />
  );
}

export default function Experience({ featured }: { featured: FeaturedRepo[] }) {
  const byRepo = new Map(featured.map((r) => [r.nameWithOwner, r]));

  /*
   * Rendered in the order they're authored in `profile-data`, deliberately.
   * A date sort lived here briefly and was reverted: Bradley wants Crossing
   * Hurdles below DevEval despite starting five months later, which is
   * exactly the placement sorting by date can't express.
   */
  return (
    <section aria-labelledby="experience-heading" className="panel">
      <div className="panel-bar">
        <h2 id="experience-heading" className="panel-bar-title">
          Experience
        </h2>
      </div>

      <div className="px-5 pb-5 pt-1">
        <ul className="flex flex-col">
          {roles
            .filter((role) => !role.hidden && !role.afterProjects)
            .map((role) =>
              roleRow(role, role.ghRepo ? byRepo.get(role.ghRepo) : undefined),
            )}
          {/*
            `afterProjects` now just means "sorts last". It was named when
            projects sat between these two groups and the flag decided which
            side of them a role fell on; with the projects gone it still does
            the one thing it was needed for, which is letting BRI Youth close
            the list. The field keeps its name because renaming it would touch
            `profile-data` for no behaviour.
          */}
          {roles
            .filter((role) => !role.hidden && role.afterProjects)
            .map((role) =>
              roleRow(role, role.ghRepo ? byRepo.get(role.ghRepo) : undefined),
            )}
        </ul>
      </div>
    </section>
  );
}
