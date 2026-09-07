import type { Config } from "tailwindcss";

/**
 * Single source of truth for colour on this site.
 * Nothing outside this file should contain a raw hex — if you need a new
 * colour, add a token here first.
 */
const tokens = {
  /*
   * The page behind the column. Steam sets `body.profile_page` to #000000 —
   * profile pages are black, and the blue #1b2838 in globalv2.css is the
   * community/store body, a different surface. Using the blue here made the
   * whole viewport one flat expanse with no column to see.
   */
  base: "#000000",
  panel: "#131c27",
  panel2: "#0e141c",
  line: "#323e4c",
  /**
   * Text ramp, tuned to Steam's. Steam runs cool blue-greys, not warm creams,
   * and reserves pure white for headings — `ink` was #e9e7e2 and read warm
   * against everything else.
   */
  bright: "#ffffff",
  ink: "#e5e8ea",
  copy: "#c7d5e0",
  muted: "#8f98a0",
  accent: "#de9b35",
  live: "#5cc98f",
  /*
   * Back after the Item Showcase took it out: `/about`'s inventory tiles
   * use it for the middle rarity tier. Kept as a token rather than a hex at
   * the call site so the two rarity scales on this site can't drift.
   */
  nebula: "#417a9b",
  /*
   * The one red on the site, for a "not recommended" review. GitHub's own
   * danger red rather than a new hue — it sits next to `live` green in that
   * panel, and those two as a pair are already universally legible.
   */
  danger: "#f85149",

  // Added for the Steam-profile layout.
  /** Link / heading blue. */
  link: "#66c0f4",
  /*
   * The three bio-line colours. They've been in three positions: on the whole
   * sentence, off entirely when Bradley wanted the bio white, and now on the
   * **org link only** — the sentence stays white and the org name carries its
   * colour, so the hue marks the word it belongs to rather than tinting a line
   * of unrelated text.
   *
   * The values took several passes to land and the reasoning is worth not
   * relearning:
   *
   * - `berkeley` #dca009 is hsl(43, 92, 45). It went to hue 48 once and read
   *   too yellow and too bright, so it's back near California Gold's own 41
   *   and darker — gold rather than lemon. Raising the hue past ~46 or the
   *   lightness past ~50 is what makes it yellow again. 6.45:1.
   *   Berkeley's blue can't be used at all here: #003262 is 1.16:1 on this
   *   column, lost in the background's own hue family.
   * - `medimpact` #b771f4 is hsl(272, 85, 70), darkened from 74 by request.
   *   **70 is the floor.** It's the least legible colour on the page at
   *   4.75:1, and one more step down — L=66, #ad5ff2 — is 4.05:1, under the
   *   4.5:1 AA needs for text this size. Darker means dropping saturation
   *   too, or accepting a fail.
   * - `deveval` #60ebdb is hsl(173, 78, 65). "More teal" means more saturated
   *   and slightly darker, NOT bluer — 180 is where cyan sits, and a pass that
   *   moved the hue that way is why it had to be asked twice.
   *
   * The trap is re-harmonising all three to a shared saturation. They ran
   * 60/65/76% once and read as highlighters — text more chromatic than the
   * page it sat on. That risk is lower now they're a word each rather than
   * three full lines, but it's the same mistake.
   */
  berkeley: "#dca009",
  deveval: "#60ebdb",
  medimpact: "#b771f4",
  /** Panel header bar — flat, was the left stop of a teal->purple gradient. */
  teal: "#2a475e",
  /** Profile header background — flat, was a five-stop purple sweep. */
  /**
   * The centred content column — Steam's #1b2838. On a real profile this
   * surface is the user's profile background image; here it's the flat blue,
   * which is what makes the column read as a column against the black page.
   */
  hero: "#1b2838",
  /**
   * Avatar frame band. A NARROW range of medium greys — the reference band
   * is mid-grey throughout with only a gentle top-left-to-bottom-right fall.
   * A wide light-to-dark range reads as a completely different object.
   */
  steelLight: "#9a9ea4",
  steel: "#787c82",
  steelMid: "#60646a",
  steelDark: "#4b4f55",
  /** Raised-bevel highlight (top/left edges) and shadow (bottom/right). */
  frameHi: "#b0b5bb",
  frameLo: "#3e4247",
  /** Slate background of the alias dropdown. */
  menu: "#464c58",
  /** Global nav bar — Steam's header sits darker and bluer than the page. */
  chrome: "#171a21",
};

/**
 * The bookshelf's carcass.
 *
 * Blue-grey, in the page's own family rather than a warm timber — it was
 * brown first and read as a different site's furniture parked on this one.
 *
 * Five steps because the box has five faces at different angles, and the whole
 * illusion is that they catch different amounts of light: the floor is lit
 * from above, the back sits in shadow, the sides fall between, and the front
 * lip is darkest because you're seeing its underside. Same reasoning as
 * `steelLight`/`steel`/`steelDark` on the avatar frame — describing a
 * material, not decorating a surface.
 */
const shelf = {
  /*
   * `hi` and `face` exist for the carcass only, and they are deliberately
   * lighter than anything inside the box. The frame was first built out of
   * `light`/`mid` like the interior faces, and it disappeared: a board the
   * same value as the wall behind it has no edge, which is exactly what
   * "there's no height, width and depth, it just looks like one plain"
   * describes. The boards have to out-value the opening or the shelf reads
   * as a hole rather than as an object with material around it.
   */
  hi: "#7c90b0",
  face: "#55698a",
  light: "#4a5e78",
  mid: "#3a4b61",
  base: "#2e3d50",
  dark: "#1f2a38",
  edge: "#151d28",
};

/**
 * Wood grain for the shelf surfaces.
 *
 * **Soft bands, not hard rules, and two pitches rather than one.** Every
 * surface used to carry `edge 0 1px, transparent 1px Npx` — a crisp line every
 * N pixels. At the front lip that read as brickwork and on the back panel as
 * corduroy, because grain that is visibly periodic isn't grain.
 *
 * Each layer peaks in the middle of its own period and falls to nothing at
 * both ends, so there is no edge anywhere in it. Two layers at pitches sharing
 * no factor beat against one another, and the pattern doesn't repeat until
 * their product — 77px for 7 and 11 — which is longer than most of these
 * surfaces are wide.
 *
 * Alphas are deliberately low. This is meant to be felt, not read; at the
 * values it replaced you could count the stripes.
 */
const grain = (dir: string, a: number, b: number, alpha: string) =>
  [
    `repeating-linear-gradient(${dir}, transparent 0, ${shelf.edge}${alpha} ${a / 2}px, transparent ${a}px)`,
    `repeating-linear-gradient(${dir}, transparent 0, ${shelf.edge}${alpha} ${b / 2}px, transparent ${b}px)`,
  ].join(", ");

/**
 * Screensaver colours for the bouncing logo. Deliberately vivid and fully
 * saturated — this is the one place the muted site palette doesn't apply,
 * because the reference logo is a flat bright fill. Flat colour only: no
 * gradient, no glow.
 */
const dvd = {
  yellow: "#ffe500",
  cyan: "#00e0ff",
  magenta: "#ff3cc8",
  green: "#3bff78",
  orange: "#ff7a14",
};

/**
 * Bounce timing. `alternate` means each iteration ends against a wall, so an
 * axis hits one every `duration` — 1.5s on x, 1.7s on y.
 */
const X_HIT = 1.5;
const Y_HIT = 1.7;
/**
 * Both axes only realign after the lcm of their full there-and-back cycles
 * (3.0s and 3.4s), so the hit pattern repeats every 51s. That's the tint
 * animation's period: 62 hits, of which two — 25.5s and 51s — are corners
 * where both axes land at once.
 */
const HIT_CYCLE = 51;

/**
 * Colour changes on wall contact and nowhere else, the way the screensaver
 * does. Rather than run a timer that drifts against the bounce, this lays a
 * keyframe stop at every moment an axis reverses. `steps(1)` on each stop
 * holds the colour flat until the next hit instead of interpolating toward it.
 */
function tintKeyframes(palette: string[]) {
  const hits = Array.from(
    new Set(
      [
        ...Array.from(
          { length: Math.round(HIT_CYCLE / X_HIT) },
          (_, i) => (i + 1) * X_HIT,
        ),
        ...Array.from(
          { length: Math.round(HIT_CYCLE / Y_HIT) },
          (_, i) => (i + 1) * Y_HIT,
        ),
      ].map((t) => Number(t.toFixed(6))),
    ),
  ).sort((a, b) => a - b);

  const frames: Record<string, Record<string, string>> = {
    "0%": { color: palette[0], animationTimingFunction: "steps(1)" },
  };

  // The final hit lands exactly on the loop point, where the wrap back to
  // palette[0] supplies that corner's colour change.
  hits.slice(0, -1).forEach((t, i) => {
    // Six decimals keeps each stop within ~0.001ms of the true hit; four
    // leaves it visibly late under fine sampling.
    frames[`${((t / HIT_CYCLE) * 100).toFixed(6)}%`] = {
      color: palette[(i + 1) % palette.length],
      animationTimingFunction: "steps(1)",
    };
  });

  const last = hits.length - 1;
  frames["100%"] = {
    color: palette[last % palette.length],
    animationTimingFunction: "steps(1)",
  };

  return frames;
}

/**
 * Sparse starfield, tiled. Static — it does not move or react to scroll.
 * These are radial-gradients only in the CSS sense: each one paints a single
 * 1px dot, not a colour transition. Kept when the decorative gradients went.
 */
const starfield = [
  "radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.40), transparent)",
  "radial-gradient(1px 1px at 27% 62%, rgba(255,255,255,0.22), transparent)",
  "radial-gradient(1.4px 1.4px at 41% 9%, rgba(255,255,255,0.32), transparent)",
  "radial-gradient(1px 1px at 55% 44%, rgba(255,255,255,0.18), transparent)",
  "radial-gradient(1px 1px at 63% 77%, rgba(255,255,255,0.30), transparent)",
  "radial-gradient(1.2px 1.2px at 74% 24%, rgba(255,255,255,0.26), transparent)",
  "radial-gradient(1px 1px at 82% 58%, rgba(255,255,255,0.20), transparent)",
  "radial-gradient(1px 1px at 91% 88%, rgba(255,255,255,0.34), transparent)",
  "radial-gradient(1px 1px at 6% 84%, rgba(255,255,255,0.24), transparent)",
  "radial-gradient(1.3px 1.3px at 34% 93%, rgba(255,255,255,0.28), transparent)",
  "radial-gradient(1px 1px at 48% 30%, rgba(255,255,255,0.16), transparent)",
  "radial-gradient(1px 1px at 96% 38%, rgba(255,255,255,0.22), transparent)",
].join(", ");

const config: Config = {
  /*
   * Resolved from the project root, not from this file's directory: Tailwind
   * only rebases these onto the config's own folder when `content.relative`
   * is set, and it isn't. Keep them root-relative if this file ever moves.
   */
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shelf,
        ...tokens,
        dvd,
      },
      fontFamily: {
        /*
         * "Motiva Sans" leads both stacks, so anyone who has Steam's actual
         * face installed locally gets it. It is NOT loaded by the site and
         * cannot be: Motiva Sans is Typotheque's, sold per-use, and shipping
         * the file would need a paid webfont licence. Nothing here downloads
         * it — this only names it.
         *
         * So for practically every visitor the next entry is what renders.
         * Open Sans stands in — Bradley chose it from a side-by-side of six
         * free faces set in this page's own headings. Its weight range starts
         * at 300, so nothing here should ask for 200.
         */
        display: [
          "Motiva Sans",
          "var(--font-display)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        body: [
          "Motiva Sans",
          "var(--font-body)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        /*
         * Signage only — the "Coming soon" cover. Kept out of `display` and
         * `body` on purpose: a poster face has no business in the page's own
         * typography, which is one family at light weights.
         */
        sign: ["var(--font-sign)", "ui-sans-serif", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      backgroundImage: {
        starfield,
        /*
         * Avatar frame. The one gradient left on the site: it's material
         * shading, not decoration — the reference frame is genuinely lit from
         * the top-left, and flattening it makes the bevel disappear. Every
         * decorative gradient (page glow, profile hero, panel bars, panel
         * sheen, xp fill) was removed.
         */
        /*
         * The shelf's faces. Two repeating gradients of grain over a base
         * sweep: fine lines for the grain itself, wider ones for the bands
         * between, and the sweep for light falling across the face.
         *
         * Material shading, like `avatar-frame` — not the decorative
         * gradients this site stripped out. Flatten these and the box stops
         * reading as an object and becomes four coloured rectangles.
         *
         * Grain runs left to right on the floor, along the length of a plank,
         * which is why those stops are `to bottom`: the face is folded flat,
         * so its vertical axis becomes the shelf's depth.
         */
        /*
         * Every interior surface below is shaded by one rule: how much of the
         * opening it can see. That is what a shelf's inside actually looks
         * like — the light comes in through the front, so a surface is bright
         * near the opening and falls away toward the back and into the
         * corners. Getting this backwards is what made the box read as evenly
         * lit, which no real box is.
         *
         * The axis each gradient runs along is NOT the axis it looks like in
         * the source. Each of these panels is folded into place, so work out
         * which edge is the hinge before changing a direction:
         *   floor    hinges at its bottom edge -> its TOP is the back
         *   ceiling  hinges at its bottom edge -> its TOP is the back
         *   left wall  hinges at its left edge  -> its RIGHT is the back
         *   right wall hinges at its right edge -> its LEFT is the back
         * The two walls are mirror images, which is why they can't share one
         * token — they did, and their shading ran in opposite directions.
         */
        "shelf-floor": [
          grain("to bottom", 9, 14, "12"),
          // Corners, where the floor meets each wall.
          `linear-gradient(to right, ${shelf.edge}66, ${shelf.edge}1e 12%, transparent 24%, transparent 76%, ${shelf.edge}1e 88%, ${shelf.edge}66)`,
          // Back (top) is the most occluded; the front lip end catches most light.
          `linear-gradient(to bottom, ${shelf.dark}, ${shelf.edge}00 0%, ${shelf.dark} 8%, ${shelf.base} 34%, ${shelf.mid} 62%, ${shelf.light})`,
        ].join(", "),
        "shelf-ceiling": [
          grain("to bottom", 7, 11, "10"),
          `linear-gradient(to bottom, ${shelf.mid}, ${shelf.base} 22%, ${shelf.light} 55%, ${shelf.face})`,
        ].join(", "),
        "shelf-back": [
          grain("to right", 11, 17, "0e"),
          // Corners, where the back meets each wall.
          `linear-gradient(to right, ${shelf.edge}77, ${shelf.edge}22 13%, transparent 26%, transparent 74%, ${shelf.edge}22 87%, ${shelf.edge}77)`,
          /*
           * The band under the top board. A shelf's back wall is darkest at
           * the top because the board across the front is what stops the
           * light reaching it — the single most recognisable thing about the
           * inside of a bookcase, and it was inverted here: this ran lightest
           * at the top.
           */
          /*
           * And it has to be genuinely lit down here, not near-black, or
           * nothing can cast onto it. That was the whole reason the books
           * appeared to have no shadows: between two books what you see is
           * back panel, and a black shadow on a near-black surface is
           * invisible however dark you make it. Brightest low down, where
           * light bouncing off the floor reaches — which is also where the
           * books' shadows land.
           */
          `linear-gradient(to bottom, ${shelf.edge}, ${shelf.edge} 6%, ${shelf.dark} 20%, ${shelf.base} 44%, ${shelf.mid} 66%, ${shelf.light} 88%, ${shelf.base})`,
        ].join(", "),
        /*
         * Left wall. Its inner face points right, into the light, so it is the
         * brighter of the two. Back is at its right edge.
         */
        "shelf-side-left": [
          grain("to bottom", 9, 13, "0c"),
          `linear-gradient(to right, ${shelf.light}, ${shelf.mid} 28%, ${shelf.base} 55%, ${shelf.dark} 80%, ${shelf.edge})`,
        ].join(", "),
        /*
         * Right wall. Its inner face points left, away from the light, so it
         * is the darker one — and its back is at its LEFT edge, the mirror of
         * the left wall.
         */
        "shelf-side-right": [
          grain("to bottom", 9, 13, "0c"),
          `linear-gradient(to left, ${shelf.base}, ${shelf.mid} 20%, ${shelf.dark} 48%, ${shelf.edge} 84%, ${shelf.edge})`,
        ].join(", "),
        /*
         * The carcass, seen face-on at z = 0 — two uprights, a board across
         * the top and the lip below. This is what gives the shelf an edge
         * with thickness rather than an opening cut out of nothing: each
         * board is lit across its own width, brightest at the outer edge and
         * falling to `edge` at the inner one, so the opening reads as
         * recessed behind them. Top and left are the lit pair and bottom and
         * right the shaded one, which is the same top-left source everything
         * else here uses.
         *
         * Grain runs along each board's length: horizontal bands on the
         * horizontal boards, vertical on the uprights.
         *
         * **The highlight rises to a peak and falls away, and both halves
         * need room.** These ran `hi, hi 1px, …`, which put the brightest
         * value in the palette against the board's face inside one pixel — a
         * measured 44-level step, which is a drawn line rather than a lit
         * edge. Fixing only the rise moved the cliff to the other side: `hi
         * 3px` next to `light 22%` on a 14px board is two stops 0.08px apart,
         * and it measured 45. Every stop is a percentage now, so the specular
         * scales with the board and neither slope can collapse.
         *
         * **The `face` plateau is wide on purpose.** These four are coplanar
         * faces of one piece of furniture, so they have to read as the same
         * material — and they didn't. Measured across the top-left joint, the
         * board sat around 104 and the upright beside it around 60, because
         * the upright's gradient spent more than half its 16px falling to
         * `dark`. Each board now holds `face` across roughly three quarters of
         * its width and does its darkening in the last tenth, which is where
         * the shadow of a real inner corner actually lives.
         */
        "shelf-board-top": [
          grain("to bottom", 5, 8, "0c"),
          `linear-gradient(to bottom, ${shelf.light}, ${shelf.hi} 22%, ${shelf.face} 46% 78%, ${shelf.base} 90%, ${shelf.edge})`,
        ].join(", "),
        "shelf-board-left": [
          grain("to right", 5, 8, "0c"),
          `linear-gradient(to right, ${shelf.light}, ${shelf.hi} 22%, ${shelf.face} 46% 78%, ${shelf.base} 90%, ${shelf.dark})`,
        ].join(", "),
        "shelf-board-right": [
          grain("to right", 5, 8, "0c"),
          `linear-gradient(to left, ${shelf.base}, ${shelf.dark} 16%, ${shelf.base} 34%, ${shelf.face} 52% 80%, ${shelf.light} 94%, ${shelf.base})`,
        ].join(", "),
        /*
         * The suspension wire. Steel rather than a shade of the shelf, because
         * it isn't part of the carcass — `steel` is the same grey the avatar
         * frame is made of, and against this much blue that's what reads as
         * metal. The bright stop near the top is the light catching it where
         * it leaves the wall, which is also the end furthest from the eye, so
         * it keeps the run from looking flat.
         */
        /*
         * A rod, not a tape. The gradient runs ACROSS the wire, not along it:
         * dark edge, highlight a third of the way in, falling to a darker edge
         * on the other side. That's the shading a cylinder has, and it's what
         * makes a flat div read as round — a gradient along the length can't,
         * however many stops it has.
         *
         * The highlight sits left of centre because the light is top-left, the
         * same source every other surface here is lit from.
         *
         * A second layer darkens the end that meets the wall, which is both
         * further from the eye and further inside the shelf's own shade.
         */
        "shelf-wire": [
          `linear-gradient(to top, transparent 45%, ${shelf.edge}55)`,
          `linear-gradient(to right, ${tokens.steelDark}, ${tokens.steel} 18%, ${tokens.steelLight} 38%, ${tokens.steel} 62%, ${tokens.steelMid} 84%, ${tokens.steelDark})`,
        ].join(", "),
        /*
         * The fittings at each end of a wire. A dome rather than a disc — the
         * off-centre radial highlight is the only thing at this size that says
         * the head is raised rather than painted on.
         */
        "shelf-fitting": `radial-gradient(circle at 34% 28%, ${tokens.steelLight}, ${tokens.steel} 42%, ${tokens.steelMid} 70%, ${tokens.steelDark})`,
        "shelf-lip": [
          grain("to right", 13, 19, "0b"),
          `linear-gradient(to bottom, ${shelf.light}, ${shelf.hi} 22%, ${shelf.face} 46% 76%, ${shelf.base} 88%, ${shelf.edge})`,
        ].join(", "),
        "avatar-frame": `radial-gradient(130% 130% at 8% 6%, ${tokens.steelLight} 0%, ${tokens.steel} 42%, ${tokens.steelMid} 72%, ${tokens.steelDark} 100%)`,
      },
      boxShadow: {
        panel: `0 1px 0 0 ${tokens.line}, 0 18px 40px -28px #000000`,
        "live-dot": `0 0 0 3px ${tokens.live}26`,
      },
      borderRadius: {
        panel: "3px",
      },
      maxWidth: {
        /*
         * Steam's own column widths are 616 main + 16 gap + 308 sidebar = 940.
         * Widened 25px per side at Bradley's request, to give the text more
         * room: 990 splits 2fr/1fr into ~649 + 16 + ~325. A deliberate
         * departure from the reference — the ratio is kept, the absolute
         * widths no longer match Steam's.
         */
        profile: "990px",
      },
      keyframes: {
        // Status pulse, tied to real "is the GitHub feed live" state.
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },

        /*
         * DVD-screensaver bounce inside the avatar. Two axes on two nested
         * elements with different periods and `alternate` — one element can
         * only carry one transform animation, and mismatched periods keep the
         * path from visibly looping. Travel distances assume the avatar's
         * 148px padding box (150px box-border minus the 1px well) and a 62x34
         * logo, which is 42% of the photo width as in the reference:
         * 148-62=86, 148-34=114. They must change together.
         *
         * Step counts are duration x 10, which pins the motion to 10fps — the
         * chunky cadence of the original screensaver. Change a duration and
         * you must change its step count to keep that framerate.
         *
         * Travel MUST divide evenly by its step count: 85/17 = 5px and
         * 112/16 = 7px. A fractional step (86/25 = 3.44px) lands the logo on
         * a different subpixel phase every frame, so the browser re-antialiases
         * the letterforms and the whole thing visibly jitters.
         *
         * Between those two rules, speed can only be a multiple of 10 px/s
         * (speed = 10 x px-per-step). To change it, pick the next whole
         * px-per-step and re-derive the logo size so the travel still divides.
         */
        "dvd-x": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(98px)" },
        },
        "dvd-y": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(128px)" },
        },
        /*
         * The logo is the only thing that changes colour, and it changes only
         * on wall contact — see tintKeyframes. The SVG paints with
         * currentColor, so animating `color` is enough.
         */
        "dvd-tint": tintKeyframes([
          dvd.yellow,
          dvd.cyan,
          dvd.magenta,
          dvd.green,
          dvd.orange,
        ]),

        /*
         * Exy's tail, wagging where it pokes out from behind the avatar.
         *
         * A rotation of the one real tail frame rather than a cut sequence of
         * them. His tail moves fast enough that every frame of the source
         * clip is motion-blurred into a different shape, so a real sequence
         * read as several different tails flashing rather than as one tail
         * swinging. Rotating a single clean frame is the thing that actually
         * looks like a wag.
         *
         * **The pivot is the point, and it lives at the call site**
         * (`origin-[92%_83%]`): that's the tail's base, measured off the
         * asset as the widest row of its alpha. Rotating about the element's
         * default centre swings the whole tail like a propeller, and worse,
         * swings its cropped root out from behind the photo where the straight
         * cut edge becomes visible. About the base, the root stays put and
         * hidden, and only the tip travels.
         *
         * Two amplitudes: a slow, shallow idle so a static tail doesn't read
         * as a broken image, and a faster, wider one on hover that answers the
         * pointer. Both are `motion-safe` at the call site.
         */
        wag: {
          "0%, 100%": { transform: "rotate(-6deg)" },
          "50%": { transform: "rotate(6deg)" },
        },
        "wag-fast": {
          "0%, 100%": { transform: "rotate(-13deg)" },
          "50%": { transform: "rotate(13deg)" },
        },

        /*
         * One glyph of the nav's `bt.` mark hopping. Three animation names
         * below share it at different delays, so the hop travels b -> t -> .
         * — the same order the animated favicon uses.
         *
         * **The distances are viewBox user units, not CSS pixels.** This runs
         * on `<g>` elements inside the mark's `0 0 408 292` viewBox, and a CSS
         * length in a transform on an SVG child resolves in that coordinate
         * system. So it scales with the mark rather than needing retuning per
         * size: 90 of 292 units is ~31% of the mark's height whatever it
         * renders at, which is ~11px in the 36px nav. Writing -11px here would
         * have moved it 11 units — about 1.4px, near enough to nothing.
         *
         * **The mark's viewBox is its exact ink bounds, so the glyphs sit
         * flush against the top edge and any hop clips.** The call site has to
         * pass `overflow-visible`. Expanding the viewBox instead is not an
         * option — `app/icon.tsx` places the mark by those bounds.
         *
         * The per-keyframe easing is what makes it a bounce rather than a
         * float: a thrown object decelerates going up and accelerates coming
         * down, so the rise is ease-out and the fall ease-in. One ease-in-out
         * across the whole thing reads as bobbing in water. The smaller hop at
         * 72% is the settle — a single bounce stops dead at the floor — and
         * the rest from 86% keeps repeats landing as separate hops.
         */
        /*
         * Exy walking out from behind the avatar when his tail is clicked.
         *
         * `-100%` is his own width, so he starts exactly one body-length left
         * of the slot — which is inside the photo's box, where the frame
         * paints over him — and ends flush against its right edge, fully out.
         * Being a percentage, it stays correct if the sprite is resized.
         *
         * `linear`, because he's walking at a constant speed; any easing here
         * would slide his feet at one end or the other. The duration is
         * derived from that speed at the call site, not chosen.
         */
        "exy-emerge": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },

        /*
         * A reaction emoji flying up the screen, the way they do in a Teams
         * call. Spawned on click and removed when it finishes.
         *
         * **Three paths, not one**, because identical arcs read as a UI
         * effect rather than as people reacting: `rise` goes more or less
         * straight up, `arc-l` and `arc-r` swing out and back. The component
         * picks one at random per emoji and randomises the drift, spin,
         * distance and duration on top, so no two are the same.
         *
         * Distances and angles come from custom properties set inline per
         * element. Custom properties can't be *interpolated* without being
         * registered, but they resolve fine as static values inside a
         * keyframe, and the browser interpolates between the resolved
         * results — which is all this needs.
         *
         * The fade is deliberately late. Fading from 0% makes them look like
         * they were never really there; holding full opacity most of the way
         * and dropping at the end reads as flying off the top.
         */
        "emoji-rise": {
          "0%": {
            transform: "translate(0, 0) scale(0.5) rotate(0deg)",
            opacity: "0",
          },
          "12%": {
            transform: "translate(0, -8px) scale(1.15) rotate(0deg)",
            opacity: "1",
          },
          "70%": { opacity: "1" },
          "100%": {
            transform:
              "translate(var(--dx), var(--dy)) scale(var(--end-scale)) rotate(var(--spin))",
            opacity: "0",
          },
        },
        "emoji-arc-l": {
          "0%": {
            transform: "translate(0, 0) scale(0.5) rotate(0deg)",
            opacity: "0",
          },
          "12%": {
            transform: "translate(0, -8px) scale(1.15) rotate(0deg)",
            opacity: "1",
          },
          "45%": {
            transform:
              "translate(calc(var(--dx) - 26px), calc(var(--dy) * 0.45)) scale(1) rotate(calc(var(--spin) * 0.4))",
            opacity: "1",
          },
          "100%": {
            transform:
              "translate(var(--dx), var(--dy)) scale(var(--end-scale)) rotate(var(--spin))",
            opacity: "0",
          },
        },
        "emoji-arc-r": {
          "0%": {
            transform: "translate(0, 0) scale(0.5) rotate(0deg)",
            opacity: "0",
          },
          "12%": {
            transform: "translate(0, -8px) scale(1.15) rotate(0deg)",
            opacity: "1",
          },
          "45%": {
            transform:
              "translate(calc(var(--dx) + 26px), calc(var(--dy) * 0.45)) scale(1) rotate(calc(var(--spin) * 0.4))",
            opacity: "1",
          },
          "100%": {
            transform:
              "translate(var(--dx), var(--dy)) scale(var(--end-scale)) rotate(var(--spin))",
            opacity: "0",
          },
        },

        /* The button itself kicking back when pressed. */
        "emoji-pop": {
          "0%, 100%": { transform: "scale(1)" },
          "35%": { transform: "scale(0.92)" },
          "70%": { transform: "scale(1.06)" },
        },

        /*
         * Exy shaking himself when you poke him.
         *
         * The amplitude decays — 3px down to 1 — because a shake that stays
         * even reads as a UI error state, the "wrong password" wobble. Losing
         * energy is what makes it read as an animal rather than a widget.
         *
         * A degree and a half of roll rides along with it, so it's a body
         * shaking rather than a picture sliding side to side.
         *
         * **It must live on a wrapper, not on the sprite.** The sprite carries
         * an inline `scaleX(-1)` when he faces left, and an animation's
         * transform beats inline styles in the cascade — so animating the
         * image itself would flip him round for the duration of every shake.
         */
        "exy-shake": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "15%": { transform: "translateX(-3px) rotate(-1.5deg)" },
          "30%": { transform: "translateX(3px) rotate(1.5deg)" },
          "45%": { transform: "translateX(-2px) rotate(-1deg)" },
          "60%": { transform: "translateX(2px) rotate(1deg)" },
          "80%": { transform: "translateX(-1px) rotate(-0.5deg)" },
        },

        /*
         * The mark's glyphs falling out of the nav and down the page.
         *
         * Same shape as `glyph-hop` for its first half — the rise is
         * identical, so triggering this mid-hover reads as the same gesture
         * continuing rather than a second animation starting. Then instead of
         * settling back to 0 it keeps going, accelerating, off the bottom.
         *
         * **`--fall` is in viewBox units, not pixels.** Transforms on an SVG
         * child are in the units of its viewBox, and the mark's is 408x292
         * rendered at 50x36 — so a pixel of screen travel is 292/36 ≈ 8.1
         * units. `NavMark` does that conversion; nothing here should be read
         * as a screen distance.
         *
         * `forwards` so the glyphs stay gone at the end. Without it they snap
         * back into the nav the instant the animation finishes, which is the
         * one thing this must not do — they are supposed to be behind the
         * profile block now.
         */
        "glyph-fall": {
          "0%": {
            transform: "translateY(0)",
            animationTimingFunction: "cubic-bezier(0.33, 0, 0.2, 1)",
          },
          "22%": {
            transform: "translateY(-90px)",
            animationTimingFunction: "cubic-bezier(0.55, 0, 1, 0.45)",
          },
          "100%": { transform: "translateY(var(--fall, 2000px))" },
        },
        "glyph-hop": {
          "0%": {
            transform: "translateY(0)",
            animationTimingFunction: "cubic-bezier(0.33, 0, 0.2, 1)",
          },
          "30%": {
            transform: "translateY(-90px)",
            animationTimingFunction: "cubic-bezier(0.6, 0, 0.9, 0.4)",
          },
          "58%": {
            transform: "translateY(0)",
            animationTimingFunction: "cubic-bezier(0.33, 0, 0.2, 1)",
          },
          "72%": {
            transform: "translateY(-26px)",
            animationTimingFunction: "cubic-bezier(0.6, 0, 0.9, 0.4)",
          },
          "86%, 100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-live": "pulse-live 2.4s ease-in-out infinite",
        // jump-none, not the default jump-end — see the keyframe note.
        // fps = steps / duration, so both of these are 10fps.
        // Durations must stay X_HIT / Y_HIT or the tint desyncs from the walls.
        "dvd-x": `dvd-x ${X_HIT}s steps(15, jump-none) infinite alternate`,
        "dvd-y": `dvd-y ${Y_HIT}s steps(17, jump-none) infinite alternate`,
        "dvd-tint": `dvd-tint ${HIT_CYCLE}s linear infinite`,
        // ease-in-out, not linear: a tail decelerates at the end of each
        // swing and snaps back through the middle. Linear reads mechanical.
        wag: "wag 1.9s ease-in-out infinite",
        "wag-fast": "wag-fast 0.5s ease-in-out infinite",
        /*
         * Three names for one keyframe set, differing only in delay — because
         * **the delay has to live inside the `animation` shorthand.**
         *
         * The obvious spelling is one `animate-glyph-hop` plus a per-glyph
         * arbitrary delay utility, and it silently does nothing: the shorthand
         * resets every animation sub-property it omits, delay included, and
         * Tailwind emits the arbitrary-property rule *before* the animation
         * one. So the shorthand won and all three glyphs hopped together.
         *
         * (Don't spell that utility out here even as an example — the scanner
         * reads comments, and it gets emitted as a real, dead rule.)
         *
         * Second time value in the shorthand is the delay; the first is the
         * duration. No timing function on purpose — the keyframes set their
         * own per-segment easing.
         */
        /*
         * One hop per hover, not a loop. The class only applies while the
         * pointer is on the mark, so dropping `infinite` means it runs its
         * single cycle and rests — and moving off and back on restarts it,
         * because the class is removed and re-added.
         */
        /*
         * Three names again rather than one plus a delay utility, for the
         * reason spelled out above `glyph-hop`: the `animation` shorthand
         * resets `animation-delay`, and Tailwind emits the arbitrary-property
         * rule first, so a separate delay silently loses.
         */
        "glyph-fall": "glyph-fall 1.15s forwards",
        "glyph-fall-2": "glyph-fall 1.15s 110ms forwards",
        "glyph-fall-3": "glyph-fall 1.15s 220ms forwards",
        "glyph-hop": "glyph-hop 0.9s",
        "glyph-hop-2": "glyph-hop 0.9s 110ms",
        "glyph-hop-3": "glyph-hop 0.9s 220ms",
        // 800ms is EMERGE_MS in Exy.tsx — his walking speed over the slot's
        // width. `forwards` holds him at the far edge until the component
        // hands off to free walking on the same frame.
        "exy-emerge": "exy-emerge 800ms linear forwards",
        "exy-shake": "exy-shake 450ms ease-out",
        // `forwards` so the last keyframe (opacity 0) holds for the frame
        // between the animation ending and React removing the node.
        // ease-out: they leave the button fast and coast, like a thrown thing.
        "emoji-rise": "emoji-rise var(--dur) ease-out forwards",
        "emoji-arc-l": "emoji-arc-l var(--dur) ease-out forwards",
        "emoji-arc-r": "emoji-arc-r var(--dur) ease-out forwards",
        "emoji-pop": "emoji-pop 260ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
