"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface HeaderActionsProps {
  /** GitHub profile URL, or null when the username isn't configured. */
  profileUrl: string | null;
  email: string;
  /** Steam profile or friend-invite link. Null until Bradley supplies one. */
  steamUrl: string | null;
  /** LinkedIn profile. Null omits the row rather than linking nowhere. */
  linkedinUrl: string | null;
}

/**
 * Steam's profile action row, pared down to Message / More.
 *
 * The menu deliberately doesn't ape Steam's contents (Add to favorites, Block
 * all communication, Report violation) because none of those have a real
 * equivalent, and a menu of dead entries is exactly the kind of fake chrome
 * this site avoids. Every item is a working link.
 *
 * ## Message is a menu, not a mailto link
 *
 * It was `<a href="mailto:…">`, and on Windows that frequently **does nothing
 * at all** — if no application is registered for the mailto: protocol, which
 * is the default state of a Windows install with no desktop mail client, the
 * browser swallows the click silently. No error, no new window. Bradley hit
 * exactly that.
 *
 * There's no way to detect the failure: the navigation is handed to the OS and
 * the page is never told what happened. So the fix isn't a fallback, it's not
 * relying on the protocol in the first place — the menu offers the mail app,
 * a webmail compose URL that only needs a browser, and copying the address.
 * At least one of those works on any machine.
 */
export default function HeaderActions({
  profileUrl,
  email,
  steamUrl,
  linkedinUrl,
}: HeaderActionsProps) {
  /** Which menu is open, if either. Only one at a time. */
  const [open, setOpen] = useState<"message" | "more" | null>(null);
  const [copied, setCopied] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const messageTrigger = useRef<HTMLButtonElement>(null);
  const moreTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) {
        setOpen(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const trigger = open === "message" ? messageTrigger : moreTrigger;
      setOpen(null);
      trigger.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /*
   * Clipboard API only. The old `document.execCommand("copy")` fallback needs a
   * focused, selected DOM node and is deprecated; every browser that runs this
   * site has the async API. If it rejects — denied permission, insecure origin
   * — the label just doesn't change, and the two links above it still work.
   */
  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* no-op: the menu's other two items are unaffected */
    }
  }, [email]);

  const menuItem =
    "block w-full px-4 py-[7px] text-left text-[14px] text-copy transition-colors hover:bg-ink/10 hover:text-bright focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-accent";

  /*
   * Gmail's compose URL. It needs a browser and nothing else, which is the
   * whole point — it's the item that works on the machine where mailto: didn't.
   * Named "Gmail" rather than "webmail" because it *is* Gmail; anyone on a
   * different provider has Copy address right below it.
   */
  const gmailCompose = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;

  return (
    <div ref={root} className="flex flex-wrap items-center gap-2">
      <span className="relative flex items-center">
        <button
          ref={messageTrigger}
          type="button"
          onClick={() => setOpen((was) => (was === "message" ? null : "message"))}
          aria-expanded={open === "message"}
          aria-haspopup="true"
          className="steam-button"
        >
          Message
        </button>

        {open === "message" && (
          /* Left-aligned: Message is the leftmost control, so the panel grows
             rightward. The mirror of what More does. */
          <div className="solid absolute left-0 top-full z-20 mt-1 w-[240px] bg-menu py-1 shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
            {/*
              Labelled "(Mac)" at Bradley's request. It isn't Mac-only —
              mailto: works anywhere a mail client is registered — but this is
              the item that silently does nothing on a stock Windows machine,
              and naming the platform where it reliably works steers Windows
              visitors to the two below it instead of a dead click.
            */}
            <a href={`mailto:${email}`} className={menuItem}>
              Open in mail app (Mac)
            </a>
            <a
              href={gmailCompose}
              target="_blank"
              rel="noreferrer"
              className={menuItem}
            >
              Compose in Gmail
            </a>
            <button type="button" onClick={copyEmail} className={menuItem}>
              {copied ? "Copied" : "Copy address"}
            </button>
            {/* The address itself, so it's readable even if all three fail. */}
            <p className="px-4 pb-1 pt-2 text-[12px] leading-snug text-muted">
              {email}
            </p>
          </div>
        )}
      </span>

      {/* The menu anchors to this span, not the whole row. More is the
          rightmost control, so the panel is right-aligned to it and grows
          leftward — left-aligned it would overhang the column. */}
      <span className="relative flex items-center">
        <button
          ref={moreTrigger}
          type="button"
          onClick={() => setOpen((was) => (was === "more" ? null : "more"))}
          aria-expanded={open === "more"}
          aria-haspopup="true"
          className="steam-button gap-1.5"
        >
          More
          <span aria-hidden>⋯</span>
        </button>

        {open === "more" && (
          <div className="solid absolute right-0 top-full z-20 mt-1 w-[220px] bg-menu py-1 shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noreferrer"
                className={menuItem}
              >
                Follow on GitHub
              </a>
            )}

            {/*
              Sits directly under Follow on GitHub because the two are the same
              kind of thing — the places a visitor can actually follow him —
              and above the Steam and source rows, which are the novelties.
            */}
            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className={menuItem}
              >
                Connect on LinkedIn
              </a>
            )}

            {/*
              Omitted entirely until `steamProfileUrl` is set, rather than
              pointing at a guessed URL. See the note on that constant for how
              to get a real one-click friend link out of Steam.
            */}
            {steamUrl && (
              <a
                href={steamUrl}
                target="_blank"
                rel="noreferrer"
                className={menuItem}
              >
                Add friend on Steam
              </a>
            )}

          </div>
        )}
      </span>
    </div>
  );
}
