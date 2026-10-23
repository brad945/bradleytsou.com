/**
 * A hover note, instant by default and optionally delayed.
 *
 * This exists because `title` can't be either. The native tooltip has a
 * browser-controlled delay of roughly a second that no CSS or JS can shorten
 * — too slow where a note is wanted immediately, and not adjustable where a
 * shorter pause is wanted instead.
 *
 * **The mechanism is opacity + visibility, not `hidden` -> `block`.** It used
 * to be the latter, which is simpler and appears on the same frame the pointer
 * arrives — but `display` cannot be transitioned, so a delay was impossible to
 * express. Zero duration with zero delay behaves identically to what it
 * replaced; `delay` just moves that one number.
 *
 * `visibility` is transitioned alongside `opacity` so the note is genuinely
 * absent until it appears, rather than invisible-but-present for the duration
 * of the delay.
 *
 * **`w-max` is load-bearing.** An absolutely positioned box shrink-to-fits
 * against its containing block, and here that's the `relative` span wrapping
 * the trigger — often only a few characters wide. Without `w-max` the note
 * collapses to that width and breaks one word per line. `max-w` then caps it
 * so a long note wraps at a sensible measure instead of running off-screen.
 *
 * ## Also load-bearing
 *
 * **The group is named (`group/note`).** Both call sites sit inside elements
 * that already use the default `group` for their own hover states — the nav's
 * profile link, and potentially anything wrapping the header card. An unnamed
 * group here would fire whenever the *parent* was hovered, which is a much
 * larger target than the thing the note belongs to.
 *
 * **The note is `aria-hidden`.** Where this sits inside a link, its text would
 * otherwise be appended to that link's accessible name — a screen reader would
 * read the label and the aside as one run-on string. The tradeoff is that the
 * note is visual-only; don't put anything here that isn't also conveyed some
 * other way.
 */
export default function HoverNote({
  note,
  children,
  align = "right",
  className = "",
  delay = false,
}: {
  /**
   * What appears on hover. Kept to one short sentence.
   *
   * A node rather than a string, so a note can carry emphasis — one of them
   * is a single italicised phrase. Nothing here renders it as markup from
   * user input; it's authored at the call site.
   */
  note: React.ReactNode;
  children: React.ReactNode;
  /** Which edge the note lines up with — pick the one away from the viewport edge. */
  align?: "left" | "right";
  /** Applied to the wrapper, so a caller can keep its own layout. */
  className?: string;
  /**
   * Wait half a second before appearing, instead of showing at once.
   *
   * **The delay goes on the hovered state, not the base one**, and the
   * difference is visible. A transition uses the transition properties of the
   * state it is moving TO: on the way in that's the hover state, on the way
   * out it's the base. Put the delay on the base and it applies in both
   * directions, so the note also hangs around for half a second after the
   * pointer has left — which a tooltip must not do. On the hover state it
   * waits to appear and leaves at once.
   *
   * Written out in full rather than built from a number. Tailwind reads source
   * as text and cannot see a class name assembled at runtime, so
   * `delay-${ms}` would emit nothing and the note would appear instantly
   * whatever was passed.
   */
  delay?: boolean;
}) {
  return (
    <span className={`group/note relative ${className}`}>
      {children}
      <span
        aria-hidden
        className={`solid solid-thin solid-edged pointer-events-none invisible absolute top-full z-40 mt-1 w-max max-w-[280px] border border-line bg-menu px-2 py-1.5 text-[11px] leading-snug text-ink opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-[opacity,visibility] delay-0 duration-0 group-hover/note:visible group-hover/note:opacity-100 ${
          delay ? "group-hover/note:delay-500" : ""
        } ${align === "right" ? "right-0" : "left-0"}`}
      >
        {note}
      </span>
    </span>
  );
}
