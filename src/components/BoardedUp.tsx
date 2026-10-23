/**
 * The "Coming soon" cover, rendered in place of the profile grid while
 * `privacyScreen` is on.
 *
 * It replaces that block rather than sitting on top of it. An overlay was
 * tried first and couldn't hold: it lived inside the clipped wrapper, so an
 * anchor jump from the nav scrolled the container and carried the cover off
 * with it, and every link underneath stayed in the tab order however opaque
 * the thing painted over it was. Covering pixels doesn't disable a document.
 *
 * Because the grid isn't rendered, nothing behind this is reachable by click,
 * keyboard or View Source, and `page.tsx` still hands the fetched data to a
 * branch that never runs. No component below was edited to make that work —
 * the whole change is which branch renders.
 */
export default function BoardedUp() {
  return (
    <div className="solid mt-3 flex h-[220px] items-center justify-center rounded-panel bg-base">
      {/*
        `font-sign` is Gabarito Medium, loaded in layout.tsx for this one
        element — a free stand-in for BB Casual Pro Medium, which needs a paid
        webfont licence. See the note there before changing it.

        Tracking is near-zero, not the 0.06em this carried under Bebas. That
        was there because Bebas is caps-only and tightly fitted; Gabarito has
        lowercase and normal sidebearings, so the same value would space it
        out. Which also means the line renders sentence case now rather than
        the all-caps Bebas forced.
      */}
      <p className="font-sign text-[52px] leading-none tracking-[-0.01em] text-bright sm:text-[64px]">
        Coming soon
      </p>
    </div>
  );
}
