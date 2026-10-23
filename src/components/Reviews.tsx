import { reviews } from "@/lib/about-data";
import type { SteamPlaytime } from "@/lib/steam";

/**
 * Steam's review format, applied to things that aren't games.
 *
 * The format is doing real work here rather than being a costume. A review
 * compresses taste into a verdict, a number and one line — which is a far
 * better shape for "what am I like" than a paragraph, and it's the one Steam
 * surface the profile page never used.
 *
 * The verdict bar on the left is Steam's own tell, and the colours are the
 * site's `live` / `danger`: green means recommended everywhere else on the
 * internet, so it doesn't need a legend.
 */
export default function Reviews({
  playtime = {},
}: {
  /**
   * Live hours by Steam app id, for reviews that name one. Empty when there's
   * no key, in which case each review falls back to its own `hours` string.
   */
  playtime?: Record<number, SteamPlaytime>;
}) {
  const recommended = reviews.filter((r) => r.recommended).length;

  return (
    <section aria-labelledby="reviews-heading" className="panel">
      <div className="panel-bar">
        <h2 id="reviews-heading" className="panel-bar-title">
          Reviews
        </h2>
        {/* Counted, not written — it can't drift from the list below it. */}
        <span className="panel-bar-meta">
          {recommended} of {reviews.length} recommended
        </span>
      </div>

      <ul className="flex flex-col px-5">
        {reviews.map((review) => {
          // Live where the review names a game and the lookup worked.
          const live = review.appId ? playtime[review.appId] : undefined;
          const hours = live
            ? `${live.total.toLocaleString()} hrs on record`
            : review.hours;
          return (
          /* Hairline on the `li`, box on the `div` — the row inset in
             globals.css. */
          <li
            key={review.subject}
            className="border-t border-line/50 first:border-t-0"
          >
            <div className="solid-hover flex gap-4 py-4">
              {/*
                The verdict as a colour bar rather than a badge. Steam uses a
                thumb icon; a bar carries the same information at a glance
                without importing an icon set for two states.
              */}
              <span
                aria-hidden
                className={`mt-1 w-[3px] shrink-0 self-stretch ${
                  review.recommended ? "bg-live" : "bg-danger"
                }`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span
                    className={`label text-[10px] ${
                      review.recommended ? "text-live" : "text-danger"
                    }`}
                  >
                    {review.recommended ? "Recommended" : "Not recommended"}
                  </span>
                  {/*
                    Free text, so an estimate can carry its own tilde. See the
                    note on `Review.hours` — this page has to say which figures
                    are measured and which are guessed.
                  */}
                  <span className="t-meta">{hours}</span>
                </div>

                <h3 className="mt-1 text-[16px] leading-tight text-bright">
                  {review.subject}
                </h3>
                <p className="t-body mt-1.5">{review.body}</p>
            </div>
            </div>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
