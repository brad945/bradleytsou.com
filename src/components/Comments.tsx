"use client";

import { useEffect, useRef } from "react";
import { GISCUS_THEME_CSS } from "@/lib/giscus-theme";
import { giscus, siteRepoSlug } from "@/lib/profile-data";

/**
 * giscus-backed comments — real GitHub Discussions, not a fake widget.
 *
 * The whole thread lives on `brad945/bradleytsou.com`; visitors sign in with
 * their own GitHub account and their comments are real discussion replies.
 * Nothing is stored here, which is the point — the site has no backend, and a
 * comment box that pretended to work would be exactly the fake chrome this
 * page avoids.
 *
 * ## The ids
 *
 * `repoId` and `categoryId` are GitHub's GraphQL node ids, read off the API
 * rather than copied out of giscus.app — the same values that page generates.
 * They're **not secret**: giscus is a client-side script, so every visitor
 * receives them. They only identify which repo and category to post into.
 *
 * The category is **Announcements**, and the type matters more than the name:
 * only maintainers can open discussions in an Announcement-format category, so
 * a stranger can't create one for giscus to then adopt as a page's thread.
 * `data-strict` narrows that further. Swapping to a dedicated "Comments"
 * category later is a one-line id change.
 *
 * ## Pinned to one discussion by number, not found by search
 *
 * `data-mapping="number"` with term `1` loads
 * github.com/brad945/bradleytsou.com/discussions/1 directly.
 *
 * **This replaced `pathname` mapping, which was broken in practice.** Pathname
 * mapping makes giscus *search* GitHub for a discussion whose title matches
 * the path, and GitHub's search index lags creation by minutes. So giscus
 * created the discussion, then couldn't find the thing it had just made:
 * it rendered an empty box, and pressing Comment tried to create the
 * discussion a second time and silently failed. Discussion 1 exists with zero
 * comments because of exactly that.
 *
 * Loading by number does no search at all, so there's no lag, no fuzzy title
 * matching, and no way for a stranger's discussion to be adopted as this
 * page's thread. `data-strict` went with the search — it only tuned matching.
 *
 * The cost is that this is now **one fixed guestbook thread** rather than one
 * per path. On a one-page site that was already true; it's just explicit now.
 * A second commentable page would need its own discussion and its own number.
 *
 * If it renders an error box, the giscus app isn't installed on the repo:
 * https://github.com/apps/giscus
 */

export default function Comments() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el || el.firstChild) return;

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";

    script.setAttribute("data-repo", siteRepoSlug);
    script.setAttribute("data-repo-id", giscus.repoId);
    script.setAttribute("data-category", giscus.category);
    script.setAttribute("data-category-id", giscus.categoryId);
    script.setAttribute("data-mapping", "number");
    script.setAttribute("data-term", String(giscus.discussion));
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    /*
     * A `data:` URL rather than a hosted file or a named giscus theme.
     *
     * The widget is a cross-origin iframe, so this site's CSS can't reach
     * into it — a theme is the only lever. A hosted file didn't work: the
     * iframe is https, so an http://localhost URL is blocked mixed content
     * and the theme silently never loaded. A data: URL isn't mixed content,
     * needs no host, and behaves the same in dev and production.
     *
     * `encodeURIComponent` rather than base64, so the CSS survives any
     * non-ASCII in it and stays readable in devtools.
     */
    script.setAttribute(
      "data-theme",
      `data:text/css,${encodeURIComponent(GISCUS_THEME_CSS)}`,
    );
    script.setAttribute("data-lang", "en");
    script.setAttribute("data-loading", "lazy");

    el.appendChild(script);
  }, []);

  return (
    /*
      Panel bar, like every other section. This was written before the Steam
      typography scale existed and still carried `font-display text-lg
      font-medium tracking-tight` — a heading style used nowhere else on the
      page, which would have landed looking like a different site.
    */
    <section aria-labelledby="comments-heading" className="panel">
      <div className="panel-bar">
        <h2 id="comments-heading" className="panel-bar-title">
          Comments
        </h2>
      </div>

      <div className="p-5">
        <p className="t-meta">Sign in with GitHub to post.</p>
        {/* `solid-stop` is gone from here with the exclusive lift — see
            note 2 in globals.css. giscus is still someone else's document in
            a cross-origin iframe; it simply no longer needs to say so, since
            the panel around it holds still either way. */}
        <div ref={container} className="mt-4" />
      </div>
    </section>
  );
}
