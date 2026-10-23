import { Row } from "@/components/Experience";
import type { FeaturedRepo } from "@/lib/github";
import {
  portfolioCategories,
  projects,
  type Project,
} from "@/lib/profile-data";

/**
 * Portfolio — the built things, on `/about`.
 *
 * **These rows used to live in Experience & Projects on `/`**, and moved here
 * at Bradley's request. The two pages now split along a cleaner line than
 * before: `/` is the record an employer reads — roles, dates, orgs, who he
 * worked for — and `/about` is everything he made or likes, which is what a
 * portfolio is.
 *
 * It shares `Row` with Experience rather than restyling. The row shape is
 * Steam's "recently played" line and it's the one piece of layout both panels
 * genuinely have in common; two copies of it would drift the first time either
 * page was touched.
 *
 * Order is manual, as it is everywhere on this site — groups in the order
 * `portfolioCategories` lists them, rows in the order they're authored in
 * `projects`. A date sort was tried on the old merged panel and reverted
 * within the hour; the reasoning is recorded there and it applies here too.
 *
 * **Groups render even when empty**, with a line saying so. Two of them are
 * empty today because Bradley asked for the headings ahead of the work, and a
 * heading over nothing is the thing this site removed from the profile page
 * once already — so it gets the same treatment `PlannedSources` gives an
 * unbuilt source in Recent Activity, which is to say what isn't there instead
 * of leaving a hole.
 */

/*
 * `kind` — Software / Design / Research — is no longer rendered, at Bradley's
 * request. It sat under each name as a subtitle and said the least of anything
 * on the row: the blurb already tells you what the thing is, and on a page
 * where six of seven entries are "Software" it was a column of the same word.
 *
 * The field stays on `Project`. It's a real classification and it's cheap to
 * keep, but note it now joins `rarity` as data nothing displays — so nothing
 * on the page can check it.
 */
function projectRow(project: Project, repo?: FeaturedRepo) {
  const href =
    project.href ??
    project.repo ??
    (repo && !repo.isPrivate ? repo.url : undefined);

  /*
   * A project with a backing repo the API reports private, and no other link,
   * has nothing a visitor can open — so it gets the tag instead. `repo` is only
   * populated for repos in `featuredRepos`, so a private one outside that list
   * shows neither, which is correct: nothing here knows it exists.
   */
  const isPrivate = !href && Boolean(repo?.isPrivate);

  return (
    <Row
      key={`project-${project.id}`}
      title={project.name}
      href={href}
      isPrivate={isPrivate}
      award={project.award}
      blurb={project.blurb}
      tags={project.tags}
      /*
       * Both halves are optional now. `period` is unset on an entry whose
       * dates nobody has confirmed and `language` is absent until the repo is
       * in `featuredRepos`, so this can legitimately come out empty — which
       * renders as nothing rather than as a stray separator.
       */
      meta={[project.period, repo?.language].filter(Boolean).join(" · ")}
    />
  );
}

export default function Portfolio({ featured }: { featured: FeaturedRepo[] }) {
  const byRepo = new Map(featured.map((r) => [r.nameWithOwner, r]));

  return (
    <section aria-labelledby="portfolio-heading" className="panel">
      <div className="panel-bar">
        <h2 id="portfolio-heading" className="panel-bar-title">
          Portfolio
        </h2>
      </div>

      <div className="flex flex-col gap-5 px-5 pb-5 pt-4">
        {portfolioCategories.map((cat) => {
          const rows = projects.filter(
            (p) => (p.category ?? "projects") === cat.id,
          );
          return (
            <div key={cat.id}>
              {/*
                `t-label`, not `.label`. The two are easy to confuse and look
                nothing alike: `.label` is 10px uppercase mono with 0.18em
                tracking, which this file's own notes call the single most
                un-Steam thing you can add, and it's scoped to tiny chrome
                labels for that reason. A group heading is page text, so it
                takes the page's own 14px — the same class the source names in
                Recent Activity use.

                No colour override on it either, so it lands on `t-label`'s own
                `muted` (#8f98a0). That's Bradley's "grey but obvious": a true
                grey rather than the blue-grey `copy` it had, and still well
                clear of the panel behind it. It reads as a label for the rows
                under it instead of competing with their titles.
              */}
              <h3 className="t-label">{cat.label}</h3>
              {rows.length > 0 ? (
                <ul className="mt-1 flex flex-col">
                  {rows.map((project) =>
                    projectRow(
                      project,
                      project.ghRepo ? byRepo.get(project.ghRepo) : undefined,
                    ),
                  )}
                </ul>
              ) : (
                <p className="solid solid-thin solid-edged mt-2 border border-dashed border-line px-3 py-2 text-[13px] text-muted">
                  {cat.empty}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
