import Image from "next/image";
import AvatarTilt from "@/components/AvatarTilt";
import HeaderActions from "@/components/HeaderActions";
import HoverNote from "@/components/HoverNote";
import NameHistory from "@/components/NameHistory";
import type { GitHubStats } from "@/lib/github";
import {
  aliases,
  experience,
  linkedinUrl,
  profile,
  privacyScreen,
  profileLevel,
  steamProfileUrl,
  type BioLine,
} from "@/lib/profile-data";

/**
 * Highest Steam Years of Service badge with art in `public/`. Valve publishes
 * well past 10; add the file and raise this when the number gets there.
 */
const STEAM_BADGE_YEARS = 10;

interface ProfileHeaderProps {
  stats: GitHubStats | null;
}

/**
 * The bouncing screensaver mark. Drawn here from primitives — skewed wordmark
 * over a flattened ellipse — rather than embedding the real logo file.
 *
 * Flat fill, nothing else: no gradient, no glow, and only a trace of shadow so
 * it stays legible over a light avatar. Everything paints with `currentColor`,
 * so the `dvd-tint` animation is the single thing that changes its colour.
 */
function DvdLogo() {
  return (
    <svg
      width="69"
      height="39"
      /* Cropped to the mark's actual ink bounds. A 0-0-110-62 box carries ~4px
         of transparent padding under the ellipse and ~6px right of the last D,
         so the element could touch a wall while the logo visibly stopped short.
         Recompute this if any glyph, the skew, or the ellipse stroke changes. */
      viewBox="7.27 3 92 51.75"
      fill="none"
      className="block animate-dvd-tint drop-shadow-[0_1px_1px_rgba(0,0,0,0.075)]"
      aria-hidden
    >
      {/*
        The glyphs are drawn as paths, not set in a font. The mark's letterforms
        are squat and slab-heavy with tight counters — no font-weight on a
        webfont gets close, which is why earlier passes using <text> at 900
        still read wrong however much they were nudged.

        Each D is one evenodd path: outer shell then counter. skewX(-14) is the
        italic slant; it shifts lower points left, so the group is translated
        right to keep the mark inside the viewBox.
      */}
      <g
        transform="skewX(-14) translate(16 3)"
        fill="currentColor"
        fillRule="evenodd"
      >
        <path d="M0 0 H15 C24 0 28 6.5 28 16 C28 25.5 24 32 15 32 H0 Z M8.5 8 H14 C18 8 19.5 11 19.5 16 C19.5 21 18 24 14 24 H8.5 Z" />
        <path
          transform="translate(29 0)"
          d="M0 0 H9.5 L13 19 L16.5 0 H26 L18 32 H8 Z"
        />
        <path
          transform="translate(56 0)"
          d="M0 0 H15 C24 0 28 6.5 28 16 C28 25.5 24 32 15 32 H0 Z M8.5 8 H14 C18 8 19.5 11 19.5 16 C19.5 21 18 24 14 24 H8.5 Z"
        />
      </g>

      {/*
        A thick ring, not a hairline — at small sizes the open centre plus the
        VIDEO lettering is what reads as the disc. The wordmark overlaps its
        top edge.
      */}
      <ellipse
        cx="52"
        cy="43"
        rx="41"
        ry="8.5"
        stroke="currentColor"
        strokeWidth="6.5"
      />
      <text
        x="52"
        y="46.4"
        textAnchor="middle"
        fill="currentColor"
        fontSize="9.5"
        fontWeight="800"
        fontFamily="var(--font-sans), sans-serif"
        letterSpacing="0.4"
      >
        VIDEO
      </text>
    </svg>
  );
}

/**
 * Splits a bio line on its `linkText` and wraps that piece in an anchor,
 * leaving the rest as plain text. Splitting at render keeps the sentence one
 * editable string in `profile-data` rather than three fragments.
 *
 * **`line.className` colours the link, not the line.** The org colours were on
 * the whole sentence once and then taken off entirely when Bradley wanted the
 * bio white; this is the third position and the useful one — the sentence
 * stays white and the org name carries its own colour, so the colour marks
 * exactly the word it belongs to instead of tinting a line of unrelated text.
 *
 * The underline stays. `decoration-current` means it takes the org colour
 * automatically, so it still reads as a link without needing link-blue.
 */
function renderBioLine(line: BioLine) {
  if (!line.linkText || !line.href) return line.text;
  const at = line.text.indexOf(line.linkText);
  if (at === -1) return line.text;

  return (
    <>
      {line.text.slice(0, at)}
      <a
        href={line.href}
        target="_blank"
        rel="noreferrer"
        className={`font-semibold underline decoration-current/40 underline-offset-2 transition hover:decoration-current ${
          line.className ?? ""
        }`}
      >
        {line.linkText}
      </a>
      {line.text.slice(at + line.linkText.length)}
    </>
  );
}

export default function ProfileHeader({ stats }: ProfileHeaderProps) {
  const { years } = experience();

  /*
   * Bradley's own photo, replacing `stats.avatarUrl` from the GitHub API.
   *
   * This is the one thing on the page that stopped being fetched, so it's the
   * one that can now go stale silently — the rest of the header still can't.
   * Changing his GitHub picture no longer changes this; edit the file. (The
   * alternative was to set it on GitHub and let the fetch carry it, which
   * would have kept that property, but he supplied the image directly.)
   *
   * Cropped from the full-frame original, 600x600 at q90.
   *
   * Earlier passes worked from a circular-cropped copy of the same photo, and
   * every framing decision there was a trade against the circle: the widest
   * square with no disc edge in it was only 321px, which read tight, and
   * going wider bought scene at the price of black corner nicks. The original
   * ends that — the frame is 1652x1576, so a full-height 1576px square is
   * almost the entire photo, and the crop is now free.
   *
   * It's the centred square. With only 76px of horizontal slack the three
   * possible squares are near-identical, so centring costs nothing and keeps
   * all three faces whole. 600px is 4x the 150 it renders at, headroom well
   * past 2x; if it ever wants tightening, crop toward the right, which is
   * where Bradley is.
   */
  const avatar = "/avatar.jpg";

  /*
   * Keyed off the derived years, not hardcoded: it rolls over on its own every
   * January, and fixed art would quietly contradict the card beside it. Note
   * this tracks the Years of Experience card, NOT the Level circle — those are
   * unrelated numbers. Only the years present in `public/` are wired up; past
   * that it falls back to the generated tile rather than a broken image.
   */
  const badge =
    years >= 1 && years <= STEAM_BADGE_YEARS
      ? `/steam-years-${years}.png`
      : null;

  // The header deliberately has no `overflow-hidden`: it would clip the alias
  // dropdown. Nothing here overflows, so nothing needs clipping.
  return (
    /*
      `bg-hero` is now the page colour, so this reads as part of the page
      rather than a card sitting on it — the purple slab is gone.
    */
    <header id="profile" className="relative bg-hero">
      <div className="relative grid gap-6 p-6 lg:grid-cols-[2fr_1fr]">
        {/* Identity */}
        <div className="flex flex-col gap-5 sm:flex-row">
          {/*
            `relative` so `#exy-den` below can anchor to the frame's edge, and
            `self-start` so it can anchor to the frame's *height*. Without it
            this flex item stretches to the row — the text column is taller —
            and the den's `top-%` would resolve against that instead of
            against the photo.
          */}
          {/*
            `z-10` lifts the whole avatar block — frame, tail, and Exy walking
            out — above the bio text beside it, which is otherwise a later
            sibling and would paint over him as he emerges. It stays below the
            `z-20` menus and Exy's own `z-30` free-walking layer, so nothing
            else changes order.
          */}
          <div className="relative z-10 shrink-0 self-start">
            {/* Static brushed-grey frame with a dark inner edge, per the
                reference. w-fit keeps it square when the header stacks. */}
            {/*
              Measured off the reference: side bands are 10.6% of the photo's
              width, top/bottom 6.1% of its height (76px and 43.5px against a
              720x717 photo) — a 1.75 ratio. On this 169px avatar that's an
              18 / 10 total band. The 1px bevel border counts toward that, so
              the padding is 17 / 9. Bigger and it stops reading as a frame.

              Both scale with the photo — they're percentages of it, so a
              resize means recomputing them rather than keeping the old px.

              The band is not flat: it's a raised bevel. Light on the top and
              left edges, dark on the bottom and right, with the photo sitting
              in a sunken well (the reverse) below it.
            */}
            {/*
              Exy hides behind the photo, and only his tail shows.

              `#exy-den` is an empty anchor, not the sprite — the sprite and
              all of his state live in `components/Exy.tsx`, which portals into
              this element once it's mounted. That keeps one component owning
              whether he's asleep, awake or walking, and leaves this file
              owning only *where* he hides. No props, no context, no lifted
              state.

              **It must stay before the frame in DOM order.** Both are
              positioned with `z-index: auto`, so the later sibling paints on
              top — which is what puts the photo over him and leaves only the
              tail poking out. It's also what makes the click target correct:
              the covered part of the tail isn't clickable because the frame is
              genuinely over it.

              **Sized explicitly, and offset with `left`, not `right-full` plus
              a percentage translate.** That was the first spelling and the
              tail never appeared: an absolutely positioned box with
              `right: 100%` and `width: auto` shrink-to-fits against the space
              between the containing block's left edge and its own right edge —
              which is zero here — and a percentage translate on top of that
              resolves against whatever width it ended up with. Stating the
              77x86 outright removes both.

              **Left edge, not right, and that's a measurement rather than a
              preference.** 32px of the tail stands clear of the frame. On the
              right that lands it inside the bio text, only a 20px `gap-5`
              away, which paints over him — a fluffy tail behind the words. On
              the left it has the header's `p-6` plus the column's `px-4`,
              ~40px of empty margin, and touches nothing. Pushing further out
              than 32 walks the tip toward the black surround and it starts to
              read as falling off the card.

              77x86 is the tail asset at its render height; changing
              `TAIL_PX` in Exy.tsx means changing these.
            */}
            {/*
              **No transform here, and that is load-bearing.** This used to
              centre itself with `top-[52%] -translate-y-1/2`. A transform
              creates a stacking context, which trapped everything inside the
              den — including the hover note on the tail, whose `z-40` was
              being resolved against the den instead of against the frame, so
              the note painted *under* the photo.

              `calc(52% - 43px)` is the same position with no transform: half
              of the den's own 86px height. Without a stacking context the tail
              still paints under the frame, because it has no z-index and comes
              first in DOM order, while the note's z-40 now lifts it clear.
              Change the height and change the 43.
            */}
            <div
              id="exy-den"
              className="absolute left-[-32px] top-[calc(52%-43px)] h-[86px] w-[77px]"
            />

            {/*
              Where he walks out, once the tail is clicked.

              Also before the frame in DOM order, for the same reason: he
              starts translated a full body-length left of this slot, which
              puts him inside the photo's box with the frame painting over him,
              and walks right until he's clear. See `exy-emerge`.

              `left-full` is safe here — unlike the tail's den, this one is
              sized outright, so there's no shrink-to-fit against zero
              available width.

              183x104 is the side sprite at its render height (408x232 scaled
              to 104 tall). Sitting near the base of the photo, because a dog
              walking out level with Bradley's head reads as floating.
            */}
            <div
              id="exy-emerge"
              className="absolute bottom-[6px] left-full h-[104px] w-[183px]"
            />

            {/*
              The frame leans toward the cursor instead of lifting, at
              Bradley's request — see `AvatarTilt.tsx`, which owns the
              tracking and adds `solid-track` itself so that a browser which
              can't or shouldn't track keeps the ordinary hover lift. The
              class string is otherwise exactly what the plain `div` carried.
            */}
            <AvatarTilt className="solid solid-deep solid-edged solid-steel relative w-fit border border-b-frameLo border-l-frameHi border-r-frameLo border-t-frameHi bg-avatar-frame px-[17px] py-[9px]">
              <div className="relative h-[169px] w-[169px] overflow-hidden border border-b-frameHi border-l-frameLo border-r-frameHi border-t-frameLo bg-base">
                {/* The `profile.initials` fallback that used to sit here is
                    gone with it: it existed because the GitHub avatar could
                    fail to resolve, and a local asset either ships or breaks
                    the build. `unoptimized` went too — it was there because
                    the source was a remote host. */}
                <Image
                  src={avatar}
                  alt={`${profile.name} avatar`}
                  width={169}
                  height={169}
                  className="h-full w-full object-cover"
                />

                {/*
                  DVD-screensaver bounce. Two nested spans because one element
                  can carry only one transform animation. Travel distances are
                  baked into the keyframes against this box's 167px padding
                  area and the 69x39 logo — resize one and you must resize the
                  other, and the travel has to stay divisible by the step count
                  or the logo jitters. See the keyframes for why.
                */}
                {/* will-change promotes each axis to its own layer, so a step
                    composites rather than repainting the SVG. */}
                <span
                  className="pointer-events-none absolute left-0 top-0 animate-dvd-x will-change-transform"
                  aria-hidden
                >
                  <span className="block animate-dvd-y will-change-transform">
                    <DvdLogo />
                  </span>
                </span>
              </div>
            </AvatarTilt>
          </div>

          <div className="min-w-0 flex-1">
            <NameHistory name={profile.name} aliases={aliases} />

            {/*
              Handle, pronouns and location used to sit here as a mono strip.
              Removed at Bradley's request — the handle repeats the avatar and
              the nav, and the other two aren't what he wants read first.
            */}
            {/*
              Sized up now that these two lines are the only thing under the
              name: at the old body size they read as a caption rather than as
              the point of the block. 17px with snug leading.

              `text-wrap: balance` rather than a hand-tuned max-width. Either
              line can outgrow the column as the wording changes, and balance
              splits it evenly whenever it does instead of leaving a one-word
              last line. A fixed ch cap would only ever fit today's text.
            */}
            {/*
              One class for all three, so they read as one block. Size and
              weight already matched at 17/400; only the colour differed —
              the tagline was `copy` and the focus lines `muted`, which made
              the roles look like a footnote to the school.
            */}
            {[
              { text: profile.tagline, ...profile.taglineLink },
              ...profile.currentFocus,
            ].map((line, i) => (
              <p
                key={line.text}
                /*
                  20px/500. The weight is the point — Open Sans has no 200 and
                  its 400 read light beside the headings, so 500 is the next
                  step the family actually ships.

                  **The size is capped by the longest line, and `nowrap` means
                  overflowing breaks the layout rather than wrapping.** The
                  cap moved: while the second line read "AI and Software
                  Engineer Intern @ MedImpact" it measured ~418px at this size
                  against a ~387px column, so 16px was the ceiling. Shortening
                  it to "Prev AI and SWE @ MedImpact" made "Applied Math + CS @
                  UC Berkeley" the longest at ~310px, which is what bought the
                  four extra pixels.

                  **Resizing the avatar resizes this column** — it took ~23px
                  out of it going 150 -> 169. Re-measure the longest line
                  rather than assuming.

                  `whitespace-nowrap` holds it to one line outright, and
                  `text-wrap: balance` went with it: balance only does anything
                  once a line already wraps, so with nowrap it's dead weight.
                */
                /*
                  All three lines are white now. Each used to carry its org's
                  colour via `line.className` — Berkeley gold, MedImpact purple,
                  DevEval teal — and that per-line hook is gone with them, so
                  the only way a line differs from its neighbours is its words.
                  Restoring it means putting `className` back on the entries in
                  profile-data and reading it here again.
                */
                className={`max-w-[46ch] whitespace-nowrap text-[20px] font-normal leading-tight text-bright ${
                  i === 0 ? "mt-2.5" : "mt-1"
                }`}
              >
                {renderBioLine(line)}
              </p>
            ))}
          </div>
        </div>

        {/*
          Steam's right-hand header block. The Level line is sized from the
          reference (see below); the Years of Experience card is deliberately the
          plain flat version — a bevelled-tile treatment was tried and reverted.
        */}
        <div className="lg:pl-2">
          {/*
            Measured off the reference rather than eyeballed. Against the
            "Level" font-size, the ring there is:
              diameter 1.08x   ring 6.4% of diameter   numeral 0.44x   gap 0.20x
            At 34px that was 37 / 2 / 16 / 7.

            **The word and the circle are smaller than that now, at Bradley's
            request, and the numeral is not.** 28px word, 30px circle, 6px gap
            — the 1.08 and 0.20 ratios still hold, so the circle still reads as
            very nearly the same size as the word, which is the part that
            matters (an early pass at 1.29x looked obviously oversized).

            What no longer holds is the numeral: it stays at 16px, which is
            0.53x the diameter rather than 0.44x. That's the one deliberate
            break from the reference here, so don't "restore" it by scaling the
            numeral with everything else.

            **The translate on the word is doing two jobs.** `items-start`
            only lines up the two boxes, and a line box is not a letter: with
            `leading-none` the cap of the L sits 4.5px below the ring, so -4px
            was what made their visible tops match. Bradley then moved it by
            eye — 5px down, then 2 back up — landing at -1px, so the word sits
            fractionally above flush with the ring. The number carries both
            decisions at once: the 4px that cancels the box-versus-letter gap,
            and his 3px on top of it. If the font size changes, that 4 moves
            and this has to be recomputed rather than nudged again.
          */}
          {/*
            The note wraps both the word and the circle, so hovering either
            shows it — they're one thing, and a reader aiming at "26" shouldn't
            get nothing.

            `inline-flex` on the wrapper because `HoverNote` renders a span:
            left as an inline box it would sit on a text baseline and add
            descender space under a row that has no text in it.
          */}
          <HoverNote
            align="left"
            className="inline-flex"
            note="this is my actual Steam account level"
          >
            <span className="flex items-start gap-[6px]">
              <span className="-translate-y-[1px] text-[27px] font-light leading-none text-ink">
                Level
              </span>
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-accent text-[16px] font-light text-bright">
                {profileLevel}
              </span>
            </span>
          </HoverNote>

          {/*
            Two words, italicised — the note is a qualifier on the number
            beside it, not a second sentence about it. It said far more before
            and read as an apology for the figure.

            The `years` value it used to interpolate is gone with it, along
            with the spelled-out lookup table that existed only to render it.
          */}
          <HoverNote
            align="left"
            className="mt-4 block"
            note={<em>an estimate</em>}
          >
            <div className="solid flex items-center gap-3 bg-panel2/70 p-3">
              {badge ? (
                /*
                Valve's own badge art, at Bradley's explicit request — the one
                Steam-owned asset on the page, overriding the "everything is
                generated from the palette" rule the rest of the site follows.
                Sourced at 80px, the largest Valve publishes for these (100
                and up 404), and shown at 56. Measured: Next's 2x candidate
                caps at the source's own 80, so on a 2x display 56 CSS px
                asks for 112 device px and gets 80 — very slightly soft. Going
                bigger makes that worse, since there's no larger source.
              */
                <Image
                  src={badge}
                  alt={`Steam ${years}-year badge`}
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0"
                />
              ) : (
                <span className="solid solid-thin solid-edged flex h-14 w-14 shrink-0 items-center justify-center border border-accent/40 bg-panel2/80 text-[20px] font-light text-accent">
                  {years}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[14px] leading-tight text-copy">
                  Years of Experience
                </p>
              </div>
            </div>
          </HoverNote>

          {/*
            Steam's Add Friend / Message / ⋯ row, sat where Edit Profile is.

            Gone while the cover is up: it sits above the cover, so it stayed
            live and clickable on a page that otherwise reads as closed — and
            the ⋯ menu still opened onto View source and the GitHub profile.
          */}
          {!privacyScreen && (
            <div className="mt-4">
              <HeaderActions
                profileUrl={stats?.profileUrl ?? null}
                email={profile.email}
                steamUrl={steamProfileUrl}
                linkedinUrl={linkedinUrl}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
