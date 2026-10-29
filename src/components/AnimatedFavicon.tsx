"use client";

import { useEffect } from "react";

/**
 * The tab icon: each glyph of `bt.` pops up and drops back, in turn.
 *
 * ## Six frames, written out
 *
 * The animation is a literal table — b up, b down, t up, t down, period up,
 * period down — rather than offsets sampled from a curve. Two earlier versions
 * did it the other way and both failed for the same reason.
 *
 * **Smooth motion doesn't survive this medium.** Sub-pixel positions rasterise
 * across two rows of pixels with partial coverage in each, which at 16 CSS px
 * in a tab strip reads as blur; the static icon looks crisp precisely because
 * Satori places it on whole pixels. And volume doesn't help: at 84-126 frames
 * a second, browsers coalesce favicon writes and quietly drop most of them,
 * which is why several passes of raising the frame rate changed nothing.
 *
 * So this is four images, each on a whole pixel. It reads as a deliberate
 * stepped animation rather than as smooth motion that didn't arrive — and at
 * four frames the browser's repaint limit no longer stretches the loop.
 *
 * ## The rest
 *
 * - **Needs JS.** The static `/icon` stays the real favicon; this adds a
 *   second icon link on top of it after hydration, so JS-off loses nothing —
 *   and, unlike the version that overwrote `/icon`'s `href` with a `data:`
 *   URI, a crawler following the head still finds a fetchable PNG. That was
 *   half of why Google was drawing a blank circle for this site.
 * - **Stops when the tab is hidden** and restores the static icon — a tab
 *   frozen mid-hop reads as broken. Same on unmount, and it never starts under
 *   `prefers-reduced-motion`.
 * - **Assigns `href` on one stable element**, re-acquiring it if detached.
 *   Building a fresh `<link>` per frame was tried and stopped the animation
 *   dead after a cycle or two — Chrome throttles rapid churn of head elements.
 *   Re-acquisition covers `AutoRefresh` replacing the element every 300s,
 *   which otherwise froze the tab after five minutes.
 *
 * The mark is canvas primitives rather than `BtMark`'s SVG — rasterising that
 * per frame would mean an image load each time. Same 408x292 ink bounds, so
 * they stay one mark, but **two implementations of it**: a change to the
 * letterforms has to be made in both.
 */

/** The tab icon is 16 CSS px; 32 keeps it sharp on a 2x display. */
const SIZE = 32;

/** Mark size, leaving headroom above for the hop. */
const MARK_W = 26;
const MARK_H = Math.round((MARK_W * 292) / 408);

/** How far a glyph rises, in whole pixels. Fractions are what caused the blur.  */
const LIFT = -3;

/**
 * The whole animation: `[b, t, period]` offsets, and how long to hold each.
 *
 * Four frames: each glyph up in turn, then all down.
 *
 * It was six — up *and* down per glyph — and the two mid-sequence down frames
 * were dropped for a measurable reason. **Chrome rate-limits favicon repaints
 * to roughly one a second**, whatever interval the page asks for, so the cycle
 * a viewer sees is about `frames x 1s` rather than the sum of these holds. At
 * six frames that made a 1.1s loop look like five, and the pause between
 * cycles read as enormous. Each dropped frame is a second off that.
 *
 * Nothing is lost visually: a glyph landing is already shown by the next
 * frame, which has it at rest. The dedicated down frames only existed to make
 * the sequence explicit in code.
 *
 * **Every frame holds the same 250ms, the pause included** — one cycle per
 * second.
 *
 * This is the knob, and it's the one worth understanding before turning it.
 * Browsers repaint the tab icon on their own schedule, somewhere around once a
 * second, and a frame interval close to that beats against it: some frames get
 * sampled repeatedly while others are skipped. At 120ms the symptom was the t
 * hopping constantly while the b and period appeared every few seconds, which
 * reads as a bug in the sequence and is really the browser undersampling it.
 *
 * 500ms was chosen to sit at or above that floor so every frame painted once,
 * in order. 125 was tried and walked back; 250 is where Bradley settled — fast
 * enough to read as a bounce, and if the uneven-glyph symptom ever returns,
 * 500 is the number that removes it.
 */
const STEP = 250;
const PAUSE = 250;

const FRAMES: { offsets: [number, number, number]; hold: number }[] = [
  { offsets: [LIFT, 0, 0], hold: STEP },
  { offsets: [0, LIFT, 0], hold: STEP },
  { offsets: [0, 0, LIFT], hold: STEP },
  { offsets: [0, 0, 0], hold: PAUSE },
];

/** `bright` white. */
const MARK_COLOUR = "#ffffff";

/**
 * The `bt.` mark, each glyph offset vertically by whole pixels.
 *
 * Every coordinate is rounded before use, for the same reason the offsets are
 * integers: a fractional origin would put the glyphs back on sub-pixel
 * boundaries however clean the offsets are.
 */
function drawMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  offsets: [number, number, number],
) {
  const sx = w / 408;
  const sy = h / 292;
  const ox = Math.round(x);
  const oy = Math.round(y);
  const X = (v: number) => ox + Math.round(v * sx);
  const Y = (v: number, dy: number) => oy + Math.round(v * sy) + dy;

  const [db, dt, dp] = offsets;
  ctx.fillStyle = MARK_COLOUR;

  // b — stem and bowl, then the counter cut back out.
  ctx.fillRect(X(0), Y(0, db), Math.round(70 * sx), Math.round(281 * sy));
  ctx.beginPath();
  ctx.ellipse(X(126), Y(198, db), 75.5 * sx, 87 * sy, 0, 0, Math.PI * 2);
  ctx.fill();

  /*
   * `destination-out` rather than filling with a background colour — the tile
   * is transparent, so painting the counter would leave an opaque blob where
   * the hole belongs.
   */
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(X(99), Y(198, db), 29.5 * sx, 33 * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = MARK_COLOUR;

  // t — crossbar, then the stem over it.
  ctx.fillRect(X(196), Y(116, dt), Math.round(127 * sx), Math.round(55 * sy));
  ctx.fillRect(X(226), Y(58, dt), Math.round(67 * sx), Math.round(223 * sy));

  // The period.
  ctx.beginPath();
  ctx.ellipse(X(365), Y(250, dp), 42 * sx, 42 * sy, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Keyed by offsets, not frame index, so the three identical down frames share
 * one encode. Module-level, so a route refresh doesn't re-render them.
 */
const FRAME_CACHE = new Map<string, string>();

export default function AnimatedFavicon() {
  useEffect(() => {
    /*
     * **Its own `<link>`, and Next's is left exactly as it was.**
     *
     * This used to take over the one `link[rel~="icon"]` on the page and
     * overwrite its `href` with a `canvas.toDataURL()` string — and that is
     * half of why Google drew a blank circle beside the search result instead
     * of this mark. Googlebot renders JavaScript, so what it found in the
     * head was a `data:` URI, which is not a URL it can go and fetch a
     * favicon from. (The other half was the tile being 32px; see `icon.tsx`.)
     *
     * Appending instead means the crawlable `/icon` link survives untouched
     * and a browser still shows the animation, since with several icon links
     * declared it takes the last one. Removing this element is therefore all
     * that "stop" has to do — the static mark is still sitting there behind
     * it.
     */
    const OWN = "data-bt-animated";
    const makeLink = () => {
      const el = document.createElement("link");
      el.rel = "icon";
      el.type = "image/png";
      el.setAttribute(OWN, "");
      document.head.appendChild(el);
      return el;
    };
    let link: HTMLLinkElement | null = null;

    /*
     * Assigns to one stable element.
     *
     * Building a fresh `<link>` per frame was tried and was worse — it ran a
     * cycle or two and then stopped altogether, which is Chrome throttling
     * rapid churn of head elements. Reassigning `href` on a single element is
     * what every favicon library does, and it keeps animating.
     *
     * The element is re-made when detached rather than captured once:
     * `AutoRefresh` refreshes the route every 300s and can replace head
     * elements, and holding a detached one froze the tab after five minutes.
     */
    function setIcon(href: string) {
      if (!link?.isConnected) link = makeLink();
      link.href = href;
    }

    /* Drop ours and the static `/icon` link takes over again by itself. */
    function restoreStatic() {
      link?.remove();
      link = null;
      document.head
        .querySelectorAll(`link[${OWN}]`)
        .forEach((el) => el.remove());
    }

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const originX = (SIZE - MARK_W) / 2;
    // The lift travels upward, so rest sits that much lower in the tile.
    const originY = (SIZE - MARK_H) / 2 + 2;

    let i = 0;
    let timer: number | undefined;

    function tick() {
      if (!ctx) return;

      const { offsets, hold } = FRAMES[i];
      const key = offsets.join(",");

      let url = FRAME_CACHE.get(key);
      if (url === undefined) {
        ctx.clearRect(0, 0, SIZE, SIZE);
        drawMark(ctx, originX, originY, MARK_W, MARK_H, offsets);
        url = canvas.toDataURL("image/png");
        FRAME_CACHE.set(key, url);
      }

      setIcon(url);

      i = (i + 1) % FRAMES.length;
      timer = window.setTimeout(tick, hold);
    }

    function stop() {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
        restoreStatic();
      } else if (timer === undefined) {
        i = 0;
        tick();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    tick();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      restoreStatic();
    };
  }, []);

  return null;
}
