import { achievements } from "@/lib/about-data";

/**
 * Steam's achievement list, with real milestones.
 *
 * **No rarity percentages, deliberately.** Steam shows "12.4% of players have
 * this" and that figure is measured; here it could only be invented, and an
 * invented percentage sitting next to real dates would undermine both.
 *
 * The locked row is the point of the panel, not a gap in it — a full sheet
 * says nothing about what happens next.
 */
/**
 * The year an achievement sorts by: the LAST one named in its free-text date.
 *
 * "2020 – 2024" sorts as 2024, because a run of years is placed by when it
 * ended rather than when it started. An entry with no date sorts last — it is
 * unplaced, not oldest, and putting it at the top would be a guess.
 *
 * Note this is the opposite call from Experience and Portfolio, which are
 * ordered by hand and where a date sort was tried and reverted. Those lists
 * carry an argument about what matters most; this one is a record, and a
 * record reads by date.
 */
function sortYear(date: string | null): number {
  if (!date) return -Infinity;
  const years = date.match(/\d{4}/g);
  return years ? Number(years[years.length - 1]) : -Infinity;
}

export default function Achievements() {
  const unlocked = achievements.filter((a) => a.unlocked).length;
  // Newest first. `sort` mutates, so copy — `achievements` is a module-level
  // array and re-ordering it in place would leak into anything else importing it.
  const ordered = [...achievements].sort(
    (a, b) => sortYear(b.date) - sortYear(a.date),
  );

  return (
    <section aria-labelledby="achievements-heading" className="panel">
      <div className="panel-bar">
        <h2 id="achievements-heading" className="panel-bar-title">
          Achievements / Fun facts
        </h2>
        <span className="panel-bar-meta">
          {unlocked} of {achievements.length} unlocked
        </span>
      </div>

      <ul className="flex flex-col px-5">
        {ordered.map((a) => (
          /* Hairline on the `li`, box on the `div` — the row inset in
             globals.css. */
          <li
            key={a.name}
            className="border-t border-line/50 first:border-t-0"
          >
            <div className="solid-hover flex items-start gap-4 py-2.5">
              {/*
                No star tile, at Bradley's request. `unlocked` is still what the
                panel bar counts and still greys a locked row's name, so the
                distinction survives — it just no longer has an icon of its own.
                With every row unlocked today there is nothing for one to mark
                anyway, and a column of identical stars is decoration.
              */}
              <div className="min-w-0 flex-1">
                <span
                  className={`block text-[15px] leading-tight ${
                    a.unlocked ? "text-bright" : "text-muted"
                  }`}
                >
                  {a.name}
                </span>
                {a.detail && (
                  <span className="t-meta mt-0.5 block leading-snug">
                    {a.detail}
                  </span>
                )}
            </div>

            {/* Nothing rather than a dash when it isn't unlocked — the row
                already says so twice. */}
            {a.date && <span className="t-meta shrink-0 pt-0.5">{a.date}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
