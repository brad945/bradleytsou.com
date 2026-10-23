"use client";

import { useEffect, useRef, useState } from "react";

interface NameHistoryProps {
  name: string;
  /** Previous handles, most recent first. */
  aliases: string[];
}

/**
 * Steam's persona name with the caret beside it that opens the alias history.
 * Real behaviour, placeholder content — see `aliases` in lib/profile-data.ts.
 */
export default function NameHistory({ name, aliases }: NameHistoryProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node))
        setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Send focus back to the caret rather than dropping it on <body>.
      trigger.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-flex items-center gap-2">
      {/*
        Bold, at Bradley's request, and applied here rather than in
        `.t-display` — that class is also the `/about` page's `<h1>`, so
        changing it there would have bolted this decision onto a heading
        nobody asked about.

        `font-medium` (500), not bold — 700 was tried and read as shouting.
        500 is the weight the three bio lines carried before this change, so
        the header keeps the same heaviest note it always had; it has just
        moved up to the name, and the lines under it dropped to `font-normal`.

        It is still the one large element on the page not at weight 300. Light
        weights on anything big are the trait carrying most of the Steam
        resemblance, so this is a deliberate exception rather than a drift.
      */}
      <h1 className="t-display font-medium">{name}</h1>

      {/*
        The dropdown anchors to the caret, not to the name: in the reference
        the box's top-left sits directly under the arrow. That means this span
        — not the outer wrapper — has to be the containing block.
      */}
      <span className="relative flex items-center">
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={open ? "Hide previous aliases" : "Show previous aliases"}
          className="flex h-5 w-5 items-center justify-center text-ink/70 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {/* Drawn rather than typed — the ▾ glyph renders inconsistently small. */}
          <svg
            width="11"
            height="7"
            viewBox="0 0 11 7"
            className={open ? "rotate-180" : undefined}
            aria-hidden
          >
            <path d="M0.5 0.5h10L5.5 6.5z" fill="currentColor" />
          </svg>
        </button>

        {open && (
          <div className="solid absolute left-0 top-full z-20 mt-1 w-[212px] bg-menu shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
            {/*
              212px is set by this line, not chosen round: at 13px it measures
              ~175px and the 12px side padding takes it to ~200, so the header
              still holds one line. Narrow it further and it wraps.
            */}
            <p className="whitespace-nowrap px-3 pb-0.5 pt-2.5 text-[13px] text-bright">
              This user has also played as:
            </p>

            {aliases.length > 0 ? (
              <ul className="py-0.5 pb-2">
                {aliases.map((alias) => (
                  <li
                    key={alias}
                    className="px-3 py-[5px] text-[13px] text-copy"
                  >
                    {alias}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2.5 text-[13px] text-muted">
                No previous aliases
              </p>
            )}
          </div>
        )}
      </span>
    </div>
  );
}
