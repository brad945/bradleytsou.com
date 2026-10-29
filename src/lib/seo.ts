import type { Metadata } from "next";

import {
  aliases,
  profile,
  siteOrigin,
  socials,
  techStack,
} from "@/lib/profile-data";

/**
 * The two things every page's head needs that `profile-data` doesn't already
 * hold: the Open Graph block, and the structured data for `/`.
 *
 * **Everything here is derived from `profile-data`, never written.** That is
 * the same rule the visible page follows — nothing claims a fact the reader
 * can't trace — and it matters more in metadata, not less, because a crawler
 * is the one audience that can't see the page to check it against. Adding a
 * link to `socials` puts it in `sameAs`; adding a tag to a role puts it in
 * `knowsAbout`. Nothing here needs editing when the page changes.
 */

/**
 * The share card's own facts, in the one place both things that need them can
 * reach.
 *
 * `opengraph-image.tsx` reads them back out as its `alt` / `size` /
 * `contentType` exports, which is the inversion that keeps the two from
 * drifting: the builder below has to state the image's dimensions, and a
 * second copy of 1200x630 is exactly the kind of pair this repo has been
 * bitten by before.
 */
export const shareCard = {
  /* The route `app/opengraph-image.tsx` generates at. Relative, resolved
     against `metadataBase` like every other URL here. */
  path: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${profile.name} — ${profile.tagline}`,
  contentType: "image/png",
} as const;

/**
 * The Open Graph block for one page.
 *
 * **It exists because a route's `openGraph` replaces its parent's outright.**
 * Next merges `metadata` shallowly, so a page that set only `url` would lose
 * the title, the site name and the type that the root layout supplies — and a
 * page that sets nothing inherits the root's `url` verbatim, which is the bug
 * this was written for: `/about` and `/play` were both telling every scraper
 * and chat preview that they were `https://www.bradleytsou.com`. Spreading one
 * builder keeps the shared half shared and the per-page half per-page.
 *
 * `url` stays relative and is resolved against `metadataBase`, so the apex /
 * `www` decision lives in exactly one place — `siteOrigin` — as it does for
 * the canonicals.
 *
 * The type is `profile` on every page rather than `website` on the two that
 * aren't one. That is Open Graph's, not Schema's, and its vocabulary is thin
 * enough that the distinction buys nothing a scraper acts on; the structured
 * data below is where the kind of page is actually stated.
 *
 * **`images` has to be named here, and that is the trap worth knowing.** Next
 * merges the file-based `opengraph-image.tsx` into whatever `openGraph` the
 * route resolves to — so a route that declares its own loses the card unless
 * it says so. Measured: before this, `/about` and `/play` carried the card
 * because they declared no `openGraph` at all; the moment they did, the image
 * silently vanished from both while every other tag looked right.
 */
export function openGraphFor(
  path: string,
  description: string = profile.tagline,
): Metadata["openGraph"] {
  return {
    title: profile.name,
    description,
    type: "profile",
    url: path,
    siteName: profile.name,
    images: [
      {
        url: shareCard.path,
        width: shareCard.width,
        height: shareCard.height,
        alt: shareCard.alt,
      },
    ],
  };
}

/**
 * JSON-LD for the profile page, and `/` is the only page that gets it.
 *
 * `ProfilePage` wrapping a `Person` is Schema's own shape for exactly this —
 * a page *about* someone rather than a page that happens to mention them —
 * and it's what lets a search engine treat "Bradley Tsou" as an entity rather
 * than as two words on a page. `sameAs` is the load-bearing part: it's how
 * the GitHub, LinkedIn, Devpost and Steam accounts get attached to the same
 * person as this site.
 *
 * Both nodes carry an `@id`, so anything added later can point at the person
 * rather than describing him again.
 *
 * Three fields are deliberately absent. `jobTitle` and `alumniOf` have no
 * field to come from — `roles` holds titles per role, and he is *at* Berkeley
 * rather than an alum of it, so either would be invented. And there is no
 * `dateModified`: the same call `sitemap.ts` makes about `lastModified`, since
 * a build timestamp would claim the content changed on every deploy.
 */
export function profileJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${siteOrigin}/#profile-page`,
    url: siteOrigin,
    mainEntity: {
      "@type": "Person",
      "@id": `${siteOrigin}/#person`,
      name: profile.name,
      /* The handles the alias dropdown already shows, which is also most of
         what anyone who knows him would actually search for. */
      alternateName: aliases,
      url: siteOrigin,
      image: `${siteOrigin}/avatar.jpg`,
      description: profile.tagline,
      email: profile.email,
      homeLocation: { "@type": "Place", name: profile.location },
      /*
       * `Organization`, not `CollegeOrUniversity`, even though today it is
       * one: `taglineLink` is "whichever org the tagline names", and the day
       * that's an employer the narrower type would be a false statement that
       * nothing on the page could catch.
       */
      affiliation: {
        "@type": "Organization",
        name: profile.taglineLink.linkText,
        url: profile.taglineLink.href,
      },
      /* Already guaranteed to be tags attached to real work on the page. */
      knowsAbout: techStack,
      /*
       * Profile URLs only. `socials` carries a `mailto:` for the Email slot —
       * that's the `email` field above, not another profile of the same
       * person — and the entries Bradley hasn't supplied yet have no `href`
       * at all, so they drop out here exactly as they render greyed there.
       */
      sameAs: socials
        .map((s) => s.href)
        .filter((h): h is string => !!h && h.startsWith("http")),
    },
  };
}

/**
 * The JSON-LD as a string safe to put inside a `<script>`.
 *
 * Escaping `<` is what stops a `</script>` in any of the data above closing
 * the tag early and spilling the rest into the document. Nothing in
 * `profile-data` contains one today; this is here so that stays a fact about
 * the data rather than a thing to remember when editing it.
 */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
