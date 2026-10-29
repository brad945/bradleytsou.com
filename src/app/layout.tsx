import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AnimatedFavicon from "@/components/AnimatedFavicon";
import MarkReveal from "@/components/MarkReveal";
import { PlayModeProvider } from "@/components/PlayMode";
import { profile, siteOrigin, tabName } from "@/lib/profile-data";
import { openGraphFor } from "@/lib/seo";

/**
 * Steam's own face is Motiva Sans, and the Tailwind stacks now name it first
 * so a visitor who already has it installed sees it. It can't be loaded here:
 * it's Typotheque's, licensed per-use, and self-hosting the file needs a paid
 * webfont licence. That makes it a local-only nicety, not the delivered font.
 *
 * Open Sans is what actually renders for essentially everyone. Bradley picked
 * it from a side-by-side of six free faces set in this page's own headings.
 * One family for display and body, same as Steam.
 *
 * Note its weight range starts at 300 — there is no 200. Every heading that
 * asked for `font-extralight` was moved to `font-light` rather than left to
 * clamp silently, so the CSS says the weight that actually renders.
 */
/*
 * **Self-hosted woff2, not `next/font/google`, and that is a bug fix rather
 * than a preference.** next/font names its classes and families
 * `sha1(css).slice(0, 6)` of the stylesheet it built, and both the server and
 * the client compiler run that loader. With Google the stylesheet comes off
 * the network — a fetch per compiler — so the two hashes agree only while the
 * two responses are byte-identical. When they aren't, the `__variable_*` class
 * the server writes onto `<html>` names a rule the stylesheet never defines,
 * `--font-sans` resolves to nothing, and every element on the page falls back
 * to `system-ui`. That is what was live on bradleytsou.com for days: HTML
 * asking for `__variable_2fad4c` against CSS defining `__variable_4dc837`.
 *
 * Reading the files off disk makes the two hashes identical by construction.
 * There is no fetch left to disagree about, and no build-cache state that can
 * make one compiler see a different stylesheet than the other.
 *
 * **The files are the exact subsets Google was already serving**, lifted out
 * of this project's own build output, so nothing about the rendering changes
 * and nothing was re-encoded. All three families are OFL, so self-hosting is
 * what their licence is for — unlike Motiva Sans and BB Casual above, which
 * is the distinction that matters here.
 *
 * Latin only, which is the one real narrowing and worth knowing: that subset
 * is `u+00??` plus the whole general-punctuation block — every dash, curly
 * quote and ellipsis on the site — plus €, ™ and the arrows. A character
 * outside it now falls back per glyph instead of pulling a second subset.
 * `next/font/local` has no per-`src` `unicode-range`, so splitting them was
 * not on offer anyway.
 */
const sans = localFont({
  /* The weight range Google's own @font-face declared for this file. */
  src: "./fonts/open-sans-latin.woff2",
  weight: "300 800",
  variable: "--font-sans",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "100 800",
  variable: "--font-mono",
  display: "swap",
});

/**
 * Signage face, used only by the "Coming soon" cover.
 *
 * Deliberately outside the page's own typography, which is one family at light
 * weights with no tracked capitals — the rules that make the rest read as
 * Steam. A hoarding over the profile isn't part of that page, so it gets its
 * own face; `font-sign` exists so that stays visible at the call site.
 *
 * **A stand-in for BB Casual Pro Medium**, which Bradley asked for and the
 * site cannot load: it's Bold Studio's, sold per-licence, and embedding it
 * needs a paid *webfont* licence. Same wall as Motiva Sans. If that licence is
 * ever bought the swap is now one line — drop its .woff2 in beside these three
 * and change the `src` — but don't point this at a copy from a free-font
 * aggregator. Gabarito being self-hosted is not licence to self-host that one;
 * the difference is OFL versus a per-use purchase, not where the file sits.
 *
 * Gabarito is the closest free face — a geometric sans with real stroke
 * modulation rather than the dead-even strokes of Outfit or Poppins, which is
 * the trait BB Casual is built around — and it carries a true Medium, so the
 * named weight survives the substitution.
 */
const sign = localFont({
  src: "./fonts/gabarito-500-latin.woff2",
  weight: "500",
  variable: "--font-sign",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  // A handle, not the name — see `tabName`. The share card below deliberately
  // keeps the real name, so the two differ on purpose.
  title: tabName,
  description: profile.tagline,
  alternates: { canonical: "/" },
  /*
   * Built rather than written out, because a child route's `openGraph`
   * replaces this object wholesale instead of merging into it — see
   * `openGraphFor`. This used to hardcode `url: siteOrigin`, which every
   * other page then inherited, so sharing `/about` or `/play` anywhere that
   * reads Open Graph announced the homepage.
   */
  openGraph: openGraphFor("/"),
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#1b2838", // `hero`, the column colour — matches the browser chrome to the page
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${sign.variable}`}
      style={
        {
          "--font-display": "var(--font-sans)",
          "--font-body": "var(--font-sans)",
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen bg-base">
        {/* Starfield only. The nebula glow was a stack of radial gradients
            and went with the rest of them. */}
        <div
          className="pointer-events-none fixed inset-0 bg-starfield opacity-70"
          style={{ backgroundSize: "760px 760px" }}
          aria-hidden
        />
        {/*
          The 3D mark, on every page — the nav is on every page, so the gesture
          that summons it is too, and having it work on `/` alone would have
          made the mark's fall a dead end everywhere else.

          A sibling of the content rather than inside it, and that placement is
          load-bearing: it carries `-z-10`, and the wrapper below is
          `position: relative`, which puts *it* in the positioned-descendant
          paint step. So the content paints over the model wherever they
          overlap, which is what makes it read as sliding out from behind the
          profile column.

          Renders nothing until the gesture completes, so three.js is never
          fetched for a visitor who doesn't do it.
        */}
        <MarkReveal />
        {/*
          Holds whether play mode is unlocked, for this page view only — the
          Tech Stack easter egg sets it and `/play` reads it. It lives up here
          because the App Router doesn't remount a shared layout when the page
          segment changes, which is the whole of how an unlock on `/` survives
          a `next/link` to `/play` and nothing survives a reload. See
          `PlayMode.tsx`; the children stay server components.
        */}
        <PlayModeProvider>
          <div className="relative">{children}</div>
        </PlayModeProvider>
        {/* Swaps the static /icon for a stepped hop after hydration. Renders
            nothing; with JS off the static mark stays. */}
        <AnimatedFavicon />
      </body>
    </html>
  );
}
