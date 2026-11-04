import type { MutableRefObject } from "react";

/**
 * The shared vocabulary for the `b`-shoots-the-`t.` gesture, and it is its own
 * module for one reason: **both sides of it need these, and one of those sides
 * is behind a dynamic import.**
 *
 * `MarkReveal` schedules the shots and `Model3D` draws the reaction, but
 * `Model3D` is loaded with `dynamic(..., { ssr: false })` so that three.js
 * stays out of the profile page's bundle — 269kB against the page's own 104.
 * A plain `import { HIT_RED_MS } from "@/components/Model3D"` in `MarkReveal`
 * would undo that completely: a static import of any value from that module
 * pulls the whole chunk into the initial load, for a number. Keeping these
 * here, in a file that imports nothing but a React type, is what lets both
 * sides agree without either paying for the other.
 *
 * So: nothing in this file may import three.js, `@react-three/*`, or
 * `Model3D`. If something needs to, it belongs in `Model3D` instead.
 */

/**
 * How long the white impact frame lasts, and how long the red decays after it.
 *
 * Minecraft's hurt flash is the reference Bradley named — "white impact frame,
 * then red gradient for like .5 seconds" — and the white lasting barely any
 * time is most of what makes it read as an impact rather than a glow. 70ms is
 * about four frames at 60Hz: the shortest that still survives a dropped one.
 */
export const HIT_WHITE_MS = 70;
export const HIT_RED_MS = 500;

/**
 * The white flash is also floored at this many *frames*, and that is not
 * belt-and-braces — it is the part that makes it reliable.
 *
 * 70ms is about four frames at 60Hz, which is fine until the renderer isn't
 * at 60Hz. Measured on a software rasteriser driving both canvases, the gap
 * between the hit landing and the next rendered frame was 145ms: the entire
 * white window fell between two frames and **zero frames were drawn white**,
 * so the glyph went straight to red and the impact vanished. Any loaded
 * machine can do the same thing, and the symptom is a hit that reads as mushy
 * rather than as one that's broken, so nobody would think to look.
 *
 * Counting frames instead means the flash is a flash on a 144Hz monitor and
 * still exists at 7fps. Minecraft's own hurt flash is tied to ticks for the
 * same reason — the two are the same idea, and the duration above is the
 * floor on fast hardware rather than the definition.
 */
export const HIT_WHITE_FRAMES = 2;

/**
 * `HIT_RED_MS` doubles as the invulnerability window.
 *
 * A pellet landing while a hit is still running is absorbed rather than
 * restarting it, which is Minecraft's hurt cooldown and caps the white frame
 * at about 2Hz. Without it, clicking fast strobes the glyph — the flash is the
 * brightest thing on the page, so that is genuinely unpleasant rather than
 * merely busy.
 *
 * It is an alias rather than a second constant so the two cannot drift: the
 * window during which the glyph is *visibly* hurt is exactly the window during
 * which it ignores further hits.
 */
export const HIT_IFRAME_MS = HIT_RED_MS;

/** How long a pellet takes to cross the page, and how wide it is drawn. */
export const PELLET_MS = 420;
export const PELLET_PX = 14;

/**
 * Where the gun's muzzle and the target's impact point are, in client space.
 *
 * Filled every frame by `Probe` inside each canvas and read once, at the
 * moment of a shot. **A ref rather than state on purpose:** it changes 60
 * times a second and nothing renders from it, so putting it in state would
 * re-render the whole reveal at frame rate to publish a value that is almost
 * always discarded.
 *
 * Each half needs its *own* ref. They were briefly given one between them and
 * the two canvases simply overwrote each other's anchors every frame.
 */
export type ProbeRef = MutableRefObject<Partial<
  Record<"muzzle" | "impact", { x: number; y: number }>
> | null>;

/** One pellet in flight. `dx`/`dy` are frozen at the trigger — see `fire`. */
export type Shot = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
};
