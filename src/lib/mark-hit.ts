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
 * **There is deliberately no invulnerability window, and there was one.**
 *
 * The first cut copied Minecraft's hurt cooldown: a pellet landing inside the
 * red window was absorbed rather than restarting the flash. Bradley asked for
 * the opposite — "make the t 'hit' animation update per incoming bullet even
 * if its mid animation" — so every pellet now retriggers the white frame and
 * restarts the red decay from zero, however fast they arrive.
 *
 * The thing that made a cooldown tempting is real: the white frame is the
 * brightest thing on the page, so holding the mouse down strobes it. That is
 * the accepted cost of the behaviour he asked for, and it is capped by how
 * fast pellets can actually arrive — one per click, each with a 420ms flight.
 * If it ever needs taming, tame it here rather than by dropping hits, because
 * a hit that lands and shows nothing is the bug this replaced.
 */

/** How long a pellet takes to cross the page, and how wide it is drawn. */
export const PELLET_MS = 420;
export const PELLET_PX = 14;

/**
 * The catapult's counterparts, and why they aren't the pellet's.
 *
 * The `t.` rolled 90° anticlockwise is a catapult, with the `.` as the stone —
 * Bradley's second gesture, and the mirror of the gun. A stone is not a
 * bullet: it is bigger, it is slower, and it arrives with more behind it, so
 * the flight is longer and `KNOCK_SLING` lands the `b` 2.5x further than a
 * pellet moves the `t.` ("a greater knockback of like 2.5x").
 *
 * Its radius is **measured, not set**, from two anchors inside the dot itself
 * — see `ProbeRef`. The `.` is a real part of the mark, so the stone has to be
 * the size that part renders at, which changes with the canvas.
 */
export const SLING_MS = 620;
export const KNOCK_SLING = 2.5;

/**
 * How high the stone vaults, as a fraction of the gap it crosses.
 *
 * "shouldn't be a straight line to the 'b' like the bullets" — a catapult
 * lobs, and the arc is most of what separates the two weapons once the
 * projectile has left. A pellet keeps `arc` at 0 and stays flat.
 *
 * The flight is a real ballistic path rather than a curve that looks like
 * one: constant horizontal speed, parabolic vertical. That falls out of
 * sampling `4t(1-t)` at evenly spaced keyframes, which is also why the
 * stone is slowest at the top of its arc without anything easing it.
 */
export const VAULT = 0.22;

/** Minimum gap kept between the top of the arc and the top of the window. */
export const VAULT_HEADROOM = 24;

/**
 * How long a keyboard shot waits for the weapon to finish rolling.
 *
 * A click can only land on an armed weapon, because arming is what a hover
 * does. A keypress has no hover to arm it, so it does both — and firing in
 * the same frame would launch from a muzzle that is still swinging into
 * place, which on the `b` means a pellet leaving out of the top of the
 * glyph. Roughly the roll's own ease, so the shot leaves a cocked weapon.
 */
export const ROLL_LEAD_MS = 200;

/**
 * How long a weapon armed by its key stays cocked afterwards.
 *
 * A hover disarms on `pointerleave`; a keypress has nothing equivalent, so
 * without this the glyph would stay rolled for the rest of the session. It
 * is skipped while the pointer is in the box, which would otherwise unroll
 * the weapon under a pointer that is still arming it.
 */
export const KEY_DISARM_MS = 1500;

/** How long the `.` takes to fade back in once the stone has landed. */
export const DOT_FADE_MS = 420;

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
 *
 * `sling` is the `.`'s own centre and `slingEdge` a point one radius along
 * its x, both parented *inside* the dot so they ride the catapult's swing.
 * Projected, the gap between them is the stone's radius on screen, which is
 * the only honest way to size a DOM circle standing in for a rendered part of
 * the mark.
 */
export type ProbeAnchor = "muzzle" | "impact" | "sling" | "slingEdge";
export type ProbeRef = MutableRefObject<Partial<
  Record<ProbeAnchor, { x: number; y: number }>
> | null>;

/**
 * One projectile in flight. `dx`/`dy` are frozen at the trigger — see `fire`.
 *
 * Pellets and the catapult's stone are the same object with different numbers
 * in it: both are DOM circles crossing the page, so `r` and `ms` carry what
 * differs and `hits` says which glyph to hurt on arrival.
 */
export type Shot = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Radius in CSS px. */
  r: number;
  /** Flight time in ms. */
  ms: number;
  /** Apex rise in px above the straight line. 0 is a bullet's flat path. */
  arc: number;
  /** Which glyph this is aimed at. */
  hits: "b" | "t";
};
