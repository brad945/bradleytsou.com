"use client";

import { useState } from "react";
import { books, type Book } from "@/lib/profile-data";

/**
 * A bookshelf you can actually poke, rather than a list of titles.
 *
 * Rendered as a **source block inside Recent Activity**, beside GitHub and
 * Spotify — it's another thing he's been doing lately, which is what that
 * panel is for. So it has no panel chrome of its own; `ActivityFeed` supplies
 * the heading and the icon.
 *
 * Books stand as spines on a shelf: hovering lifts one and lights it up,
 * clicking pulls it out and shows what it is underneath. That's the whole
 * reason it isn't a `<ul>` — a shelf is a thing you scan by eye and reach
 * into, and a list of rows is neither.
 *
 * ## Why the motion is allowed here
 *
 * The brief bans decorative animation, and this is a lot of it. It's in the
 * same category as Exy: **nothing moves unless you point at it or click it**,
 * and the motion is the affordance — a spine that didn't respond wouldn't read
 * as reachable. It's a mechanic, not an ambient effect. All of it is
 * `motion-safe`, so it collapses to a plain colour change under
 * `prefers-reduced-motion` and the shelf still works.
 *
 * ## Two things that are load-bearing
 *
 * **Spine colours are full class strings in an array, not built by index at
 * runtime.** Tailwind's scanner reads source as text; a template string would
 * emit nothing and every spine would come out transparent. Same reason the old
 * showcase spelled its rarity classes out.
 *
 * **Heights and widths are derived from the title, not random.** A shelf of
 * identical blocks reads as a chart, but `Math.random()` would reshuffle on
 * every render and re-order on hydration. Hashing the title is stable, varies
 * naturally, and means adding a book never means choosing a size.
 */

/** Stable per-title, so nothing moves between renders or across hydration. */

/** How far the shelf runs back. Books are drawn shallower, so they sit in it. */
const SHELF_DEPTH = 110;

/**
 * Smallest spine type before a title stops reading as a title.
 *
 * Used twice and in opposite directions: as the floor a book's height is
 * sized to carry, and (as 7) as the hard floor `fontSize` clamps to if a
 * title still doesn't fit. They can disagree by 2pt without anything
 * breaking, because the height rule is a minimum and the clamp is a
 * last resort.
 */
const MIN_SPINE_FS = 8;

/**
 * Pixels per inch, and there are two of them on purpose.
 *
 * **Height is to scale.** An 11in Calvin and Hobbes treasury renders 1.4x the
 * height of an 8in Sula, because that is the ratio between them. This
 * replaced sizes hashed out of the title, under which a 656-page hardcover and
 * a 144-page play stood the same height and the shelf described nothing.
 *
 * **Thickness is exaggerated, by about 3x, and it has to be.** Sula is
 * 8in x 0.5in; at the height scale its spine would be 8px wide and a vertical
 * title does not fit in 8px. The exaggeration is one uniform factor, so every
 * book stays right *relative to* every other — which is the part a reader can
 * see — and only the absolute ratio of thickness to height is off.
 *
 * `THICK_PER_IN` is also what decides how much of the shelf the row fills: at
 * 52 the eight books plus their 20px gaps come to about 500px of the ~567px
 * opening. Raise it and they crowd the uprights; lower it and the shelf starts
 * to look empty.
 */
const HEIGHT_PER_IN = 15.2;

/**
 * The suspension wires, and the geometry behind them.
 *
 * Bradley wanted the shelf to read as jutting out of the page toward you, and
 * the way a real floating shelf says that is a cable from each front corner
 * running back and up to the wall. Nothing about the shelf itself changes; the
 * wires just give the eye two lines whose convergence is only explicable by
 * depth.
 *
 * Each wire is one thin div standing on a front-top corner and folded back
 * about its own bottom edge, exactly like the floor and the ceiling. Solve for
 * the two numbers rather than eyeballing them: the far end has to land on the
 * wall, at (-RISE, -SHELF_DEPTH) in the corner's own frame, so
 *
 *   length = hypot(RISE, SHELF_DEPTH)      angle = atan2(SHELF_DEPTH, RISE)
 *
 * and the browser does the rest. **The convergence is not drawn.** Both wires
 * stay at their own corner's x in world space; they lean toward each other on
 * screen only because their far ends are 110px deeper, which is the whole
 * point — it's real perspective rather than two lines angled by hand, so it
 * stays correct at any width the column takes.
 *
 * `RISE` is capped by what's above the shelf: the wires overshoot the block by
 * about 38px on screen, so the container's top margin has to clear that or
 * they cross the Books heading.
 */
const WIRE_RISE = 32;
/**
 * How far back on the top plank each rod is footed.
 *
 * It used to be 0 — the rod stood on the very front corner, in the z = 0
 * plane, and that is where every attempt to make the join look attached kept
 * failing. A rod ending on the front FACE has to be held there by something,
 * so it needs a bracket or a hook or an eye, and any such part is drawn
 * square-on while the rest of the shelf is foreshortened. A rod that goes into
 * the top SURFACE needs nothing: it's screwed in, the way the real thing is.
 */
const WIRE_FOOT_Z = 14;
const WIRE_RUN = SHELF_DEPTH - WIRE_FOOT_Z;
const WIRE_LEN = Math.round(Math.hypot(WIRE_RISE, WIRE_RUN));
const WIRE_TILT = Math.round((Math.atan2(WIRE_RUN, WIRE_RISE) * 180) / Math.PI);
const WIRE_W = 5;

/**
 * How far back off the front edge the books stand.
 *
 * They used to sit at z = 0, flush with the carcass, which is where nothing
 * on a real shelf sits — you push a book in until it stops. Everything
 * measured against the back wall has to subtract this: the depth cap, and both
 * offsets of the shadow a book throws on that wall.
 */
const BOOK_INSET = 11;

/**
 * Stable pseudo-random from a string.
 *
 * Back after being deleted with the hashed sizes, and for the one thing a hash
 * is actually right for here. The gaps between books have to look unplanned
 * but be the SAME on the server and on the client — `Math.random()` would
 * differ between the two and React would replace the markup on hydration.
 * Sizes are measurements and should never have come from this; spacing is a
 * choice about arrangement, and nothing about it is checkable.
 */
function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
const THICK_PER_IN = 52;

const STATUS_LABEL: Record<Book["status"], string> = {
  reading: "Reading",
  read: "Read",
  shelved: "Shelved",
};

export default function Bookshelf() {
  /** Index of the pulled-out book, or null. */
  const [open, setOpen] = useState<number | null>(null);
  const selected = open === null ? null : books[open];

  return (
    /*
      `mt-4` because the shelf is a solid object and the two other source
      blocks are rows of text: at `SourceBlock`'s own 8px the heading sat on
      the carcass rather than above it. Local to this block on purpose —
      GitHub and Spotify still want the tighter default.
    */
    /*
      `mt-12` rather than `mt-6`: the suspension wires overshoot the top of the
      block by about 38px, and at the smaller margin they crossed the Books
      heading. Raise WIRE_RISE and this has to go up with it.
    */
    /*
      `solid-stop` — see the solid system in globals.css. The shelf is the one
      thing on the page that was already 3D, and it has its own motion: a book
      tips out at -30° under the pointer. Without this the panel behind it
      counts as the innermost hovered solid and bounces at the same time, so
      the reference object ends up fighting its own container.
    */
    <div className="solid-stop mt-12">
      {/*
        A shelf, built as an actual box: back panel, two side walls, a floor,
        and in front of all of it a carcass — two uprights, a board across the
        top, the lip below — with the books standing inside.

        **The carcass is what gives the shelf an edge.** Without it the
        opening was a hole in nothing: the walls met the page with no
        material between them, so the whole thing read as one flat plane
        however much depth was behind it. Each board is lit across its own
        width, so it has a visible thickness the opening sits behind.

        **The books stand upright in it.** They leaned 12° forward first and
        it looked wrong for a reason worth keeping: a leaning book inside a
        square box has nothing holding it up, so the two read as separate
        objects at odds with each other. All the depth comes from the camera
        instead — `perspective-origin` sits above the box, so you look down
        into the shelf and see its floor and the tops of the books, with
        everything square to everything else. A hovered book is then the only thing in
        the scene that isn't, which is what makes it read as pulled out.

        Every face is a plain div folded into place, and each fold has one
        correct sign that is easy to get backwards — all four are spelled out
        below because getting one wrong puts a wall in front of the books
        instead of behind them, and it is not obvious from the result which
        one is at fault.

        `perspective` and `perspective-origin` live here, on the one element
        that contains the whole scene. Per-face they'd each get their own
        vanishing point and the box wouldn't close up.
      */}
      <div style={{ perspective: "900px", perspectiveOrigin: "50% -85px" }}>
        <div
          className="pointer-events-none relative w-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Back panel: straight back by the shelf's depth. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-shelf-back"
            style={{ transform: `translateZ(-${SHELF_DEPTH}px)` }}
          />
          {/*
            The ceiling, and the box does not close without it. The eye sits
            above the container's top edge, so the inner walls and the back
            panel project *above* that edge — you could see a wedge of shelf
            interior carrying on over the top board, which is what made the
            board look like it was floating in front of a hole rather than
            capping a box.

            Hinged at its own bottom edge like the floor, so it folds backward
            with its lit face up. That face is the top of the carcass, seen
            from slightly above, which is why it's the brightest surface here
            — it's the one pointing at the light.
          */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-full bg-shelf-ceiling"
            style={{
              height: SHELF_DEPTH,
              transformOrigin: "center bottom",
              transform: "rotateX(90deg)",
            }}
          />
          {/*
            Side walls. `rotateY(90deg)` about the LEFT edge folds a div
            backward; about the right edge it needs `-90`. Each one's visible
            face then points inward, into the shelf.
          */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-shelf-side-left"
            style={{
              width: SHELF_DEPTH,
              transformOrigin: "left center",
              transform: "rotateY(90deg)",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 bg-shelf-side-right"
            style={{
              width: SHELF_DEPTH,
              transformOrigin: "right center",
              transform: "rotateY(-90deg)",
            }}
          />
          {/*
            Floor. Hinged at its own BOTTOM edge with `rotateX(90deg)`, which
            folds it backward and leaves its lit face pointing up. Hinging at
            the top edge with `-90` puts it in the same place with its face
            pointing down — which renders as a dark slab, and was why the book
            tops kept vanishing.
          */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 bg-shelf-floor"
            style={{
              height: SHELF_DEPTH,
              transformOrigin: "center bottom",
              transform: "rotateX(90deg)",
            }}
          />

          {/* The books, standing on that floor. */}
          <div
            className="pointer-events-none flex items-end justify-center px-4 pt-8"
            style={{ transformStyle: "preserve-3d" }}
          >
            {books.map((book, i) => {
              /*
               * Straight off the edition's real spine thickness. The floor of
               * 18px is there because a thinner spine can't carry its own
               * title; nothing on the shelf is near it today.
               */
              const width = Math.max(
                18,
                Math.round(book.thickIn * THICK_PER_IN),
              );
              const isOpen = open === i;

              const label = book.spineLabel ?? book.title;
              /*
               * True trim height, with the label floor kept as a backstop.
               *
               * It doesn't fire for any of the eight today. The two that
               * would have — Common Sense Investing and The Complete Peanuts,
               * both short books with long titles — carry shortened
               * `spineLabel`s instead, which is what a real spine does at that
               * size anyway. The floor stays because a long-titled short book
               * added later would otherwise ship unreadable, and it is better
               * for one book to stand slightly too tall than for its title to
               * be a smudge.
               */
              const height = Math.max(
                Math.round(book.heightIn * HEIGHT_PER_IN),
                Math.round(label.length * MIN_SPINE_FS * 0.56) + 34,
              );
              const room = height - 34;
              /*
               * 0.56em per character is a deliberate over-estimate of Open
               * Sans semibold's advance (~0.52), so the computed size errs
               * small. The floor is 7 rather than 8 because the shortest
               * book is now 127px: at 8 the longest title overran its own
               * spine, and a clamped size that doesn't fit is worse than a
               * small one that does.
               */
              const fontSize = Math.max(
                7,
                Math.min(13, Math.floor(room / (label.length * 0.56))),
              );
              /*
               * Two thirds as deep as tall, like a real book — but capped
               * short of the shelf's own depth, or the tallest one runs
               * straight through the back panel.
               */
              const depth = Math.min(
                Math.round(height * 0.62),
                SHELF_DEPTH - BOOK_INSET - 12,
              );
              /*
               * Gap to the book on its left, 5-10px, hashed off this book's
               * own title so it never changes between renders. `justify-center`
               * still centres the row; the first book takes no margin, so the
               * gaps sit only between books and never against the uprights.
               */
              const gap = i === 0 ? 0 : 5 + (hash(book.title) % 6);

              /*
               * Wrapper, and it does not rotate. The shadow below lies in the
               * floor plane; if it lived inside the button it would tip up off
               * the floor with the book, which is the one thing a shadow can
               * never do. So the button carries the rotation and the wrapper
               * carries the ground.
               */
              /*
               * `pointer-events-none` on the row and `-auto` back on each book
               * is load-bearing, not tidying. `BOOK_INSET` puts the books 11px
               * BEHIND their own parent's plane, and in a `preserve-3d` scene
               * hit-testing is done in 3D: the row's own box sits at z = 0, in
               * front of every book in it, so it swallowed every hover and
               * click. Confirmed with `elementFromPoint` — the element under a
               * book's centre was the row div, not the button.
               *
               * It only started when the books moved back. While they were
               * flush at z = 0 they were coplanar with the row and ordinary
               * DOM order put them on top.
               *
               * Both ancestors need it — the row AND the box — because both
               * sit at z = 0. Nothing else in the shelf is interactive, so
               * turning the pointer off for the whole carcass and back on for
               * the books costs nothing and can't be re-broken by adding
               * another decorative layer at z = 0 later.
               */
              return (
                <div
                  key={book.title}
                  style={{
                    height,
                    width,
                    marginLeft: gap,
                    transformStyle: "preserve-3d",
                    // Pushed in off the front edge, the way a book on a shelf sits.
                    transform: `translateZ(-${BOOK_INSET}px)`,
                  }}
                  className="group/book pointer-events-auto relative shrink-0"
                >
                  {/*
                    Cast shadow, in the floor plane — hinged at its own bottom
                    edge exactly like the shelf floor, so it folds backward
                    with its face up rather than showing its underside.

                    Light is top-left, the same source the shelf's own
                    gradients and the avatar frame are lit from, so the shadow
                    falls back and to the RIGHT: hence the asymmetric inset and
                    the diagonal in the gradient. It runs a little past the
                    book's depth because a real one does.

                    Dynamic in the sense that matters: `--sh` stretches it
                    along the depth axis when the book tips out, since a book
                    leaning toward you throws a longer shadow. `scaleY` sits
                    to the right of the rotate so it scales in the panel's own
                    frame — which after folding is the floor's depth.
                  */}
                  <span
                    aria-hidden
                    style={{
                      height: depth + 16,
                      transformOrigin: "center bottom",
                      transform: "rotateX(90deg) scaleY(var(--sh))",
                      background:
                        "linear-gradient(to top right, rgba(0,0,0,0.6), rgba(0,0,0,0.22) 48%, rgba(0,0,0,0) 86%)",
                      /*
                       * Sides faded for the same reason as the wall shadow —
                       * a shadow's edge is a penumbra, not a cut. The near end
                       * is left alone: that end is where the book touches the
                       * floor, and contact edges genuinely are sharp.
                       */
                      maskImage:
                        "linear-gradient(to right, transparent, #000 24%, #000 76%, transparent)",
                      WebkitMaskImage:
                        "linear-gradient(to right, transparent, #000 24%, #000 76%, transparent)",
                    }}
                    className="absolute bottom-0 left-[3px] right-[-20px] rounded-b-[2px] blur-[11px] [--sh:1] transition-transform duration-300 ease-out motion-safe:group-hover/book:[--sh:1.5]"
                  />
                  {/*
                    Contact shadow. The long one above falls away too gradually
                    to darken the inch of floor a book actually touches, and
                    without that the whole row hovered a fraction above the
                    plank. Short, much darker, barely blurred — that's what
                    reads as weight. It scales on the same `--sh`, so it
                    stretches out from under the book as it tips.
                  */}
                  <span
                    aria-hidden
                    style={{
                      height: Math.round(depth * 0.34),
                      transformOrigin: "center bottom",
                      transform: "rotateX(90deg) scaleY(var(--sh))",
                      background:
                        "linear-gradient(to top right, rgba(0,0,0,0.66), rgba(0,0,0,0) 78%)",
                    }}
                    className="absolute bottom-0 left-[1px] right-[-7px] blur-[3.5px] transition-transform duration-300 ease-out"
                  />

                  {/*
                    The book's shadow on the back wall.
                    
                    The floor shadow below was the only cast shadow here, and
                    between books you mostly see the BACK of the shelf, not its
                    floor — so the one surface a reader actually looks at had
                    nothing on it. This is the missing half.

                    Where it lands follows from the light being above, in front
                    and to the left: the edge doing the casting is the book's
                    back edge, `SHELF_DEPTH - BOOK_INSET - depth` short of the
                    wall, so the
                    shadow sits just right of and below the book rather than
                    far from it. Both offsets are computed from that gap, which
                    is why a shallow book throws its shadow further than a deep
                    one — it has more room between itself and the wall.

                    It sits a pixel proud of the back panel so it can't
                    z-fight with it, and it fades as the book tips out, which
                    is what happens: a book leaning toward you stops blocking
                    the wall behind it.
                  */}
                  <span
                    aria-hidden
                    style={{
                      transform: `translateZ(-${SHELF_DEPTH - BOOK_INSET - 1}px) translate(${Math.round((SHELF_DEPTH - BOOK_INSET - depth) * 0.42) + 2}px, ${Math.round((SHELF_DEPTH - BOOK_INSET - depth) * 0.44) + 3}px)`,
                      background:
                        "linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.34) 62%, rgba(0,0,0,0.1))",
                      /*
                       * The shadow is the book's rectangle, so without this it
                       * ends in two horizontal cuts across the wall — the one
                       * shape a cast shadow never has. The mask fades both,
                       * which is what a penumbra does at the top and bottom of
                       * a real one. Safe on this element: `mask` forces
                       * `transform-style: flat` and it has no 3D children.
                       */
                      maskImage:
                        "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
                    }}
                    className="absolute inset-0 blur-[14px] transition-opacity duration-300 motion-safe:group-hover/book:opacity-35"
                  />

                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-label={`${book.title} by ${book.author}`}
                    style={
                      {
                        transformStyle: "preserve-3d",
                        // The bottom front edge, where the book meets the floor.
                        transformOrigin: "center bottom",
                        "--spine": book.spine,
                        "--ink": book.ink,
                        ...(isOpen ? { "--deg": "-30deg" } : {}),
                      } as React.CSSProperties
                    }
                    /*
                     * **No `filter` on this element, ever.** `filter` forces
                     * `transform-style: flat`, overriding `preserve-3d` — so a
                     * `hover:brightness` here collapsed the book's faces into
                     * one plane and its top vanished the moment you pointed at
                     * it. The brightening lives on the faces instead, where
                     * flattening their own 2D children costs nothing.
                     */
                    className={`group/spine absolute inset-0 [--deg:0deg] [transform:rotateX(var(--deg))] transition-transform duration-300 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-accent motion-safe:hover:[--deg:-30deg] ${
                      isOpen ? "z-20" : "z-0"
                    }`}
                  >
                    {/*
                      The two covers, which are what you actually see of a
                      book's depth on a shelf. They were missing entirely —
                      the book was a spine and a top and nothing between them,
                      which is why it read flat however the camera moved.

                      `backface-visibility: hidden` is what makes this need no
                      per-book logic: each face draws only while it genuinely
                      faces the camera, so books left of the vanishing point
                      show their right cover and books right of it show their
                      left, and the switch happens exactly where it should.

                      Their shading is the same top-left light as everything
                      else: a left-facing cover catches it and a right-facing
                      one is turned away, so the lit face is the one you see on
                      the right of the shelf. Each also darkens toward the back,
                      which is the shelf's own shade falling on it.
                    */}
                    <span
                      aria-hidden
                      style={{
                        width: depth,
                        transformOrigin: "right center",
                        transform: "rotateY(-90deg)",
                        backfaceVisibility: "hidden",
                        background: `linear-gradient(to left, color-mix(in srgb, var(--spine) 82%, #fff), color-mix(in srgb, var(--spine) 60%, #000))`,
                      }}
                      className={`absolute inset-y-0 right-full transition-[filter] duration-300 ${
                        isOpen
                          ? "brightness-110"
                          : "group-hover/spine:brightness-110"
                      }`}
                    />
                    <span
                      aria-hidden
                      style={{
                        width: depth,
                        transformOrigin: "left center",
                        transform: "rotateY(90deg)",
                        backfaceVisibility: "hidden",
                        background: `linear-gradient(to right, color-mix(in srgb, var(--spine) 58%, #000), color-mix(in srgb, var(--spine) 34%, #000))`,
                      }}
                      className={`absolute inset-y-0 left-full transition-[filter] duration-300 ${
                        isOpen
                          ? "brightness-110"
                          : "group-hover/spine:brightness-110"
                      }`}
                    />

                    {/*
                      The page block — the book's top face.

                      Sits ABOVE the spine (`bottom-full`) and hinges at its own
                      bottom edge, so `rotateX(90deg)` folds it backward with its
                      lit side up. The earlier version hinged it at the top edge
                      with `-90`: same position, face pointing down, so what you
                      saw was its underside and it dropped out of view entirely
                      once a book tipped far enough. That was the disappearing
                      top.

                      Paper, not the cover colour. It was a darkened tint of
                      the spine, which is what a shelf never shows you: the top
                      of a book standing spine-out is its page block, and paper
                      against a coloured spine is most of what reads as a solid
                      object. The stripes run across the width because that is
                      how pages stack — the spine's width IS the thickness of
                      the stack — and each one is a single page's edge.

                      Soft-peaked rather than hard-ruled, for the same reason
                      the shelf's own grain is: a 1px line every 2.5px is below
                      the size where a screen can draw it honestly, and it
                      moirés instead. A band that fades in and out reads as
                      paper at any zoom.
                    */}
                    <span
                      aria-hidden
                      style={{
                        height: depth,
                        transformOrigin: "center bottom",
                        transform: "rotateX(90deg)",
                        background: `
                          repeating-linear-gradient(to right, rgba(0,0,0,0) 0, rgba(0,0,0,0.085) 1.1px, rgba(0,0,0,0) 2.4px),
                          linear-gradient(to top, rgba(0,0,0,0.22), rgba(0,0,0,0) 55%),
                          color-mix(in srgb, #f1ebdd 88%, var(--spine))`,
                      }}
                      className={`absolute inset-x-0 bottom-full transition-[filter] duration-300 ${
                        isOpen
                          ? "brightness-110"
                          : "group-hover/spine:brightness-110"
                      }`}
                    />
                    {/* The spine, facing you. */}
                    <span
                      aria-hidden
                      style={
                        {
                          background: book.spine,
                          "--spine": book.spine,
                          "--ink": book.ink,
                        } as React.CSSProperties
                      }
                      className={`absolute inset-0 overflow-hidden rounded-t-[1px] transition-[filter] duration-300 ${
                        isOpen
                          ? "brightness-110"
                          : "group-hover/spine:brightness-110"
                      }`}
                    >
                      <span
                        className="absolute inset-x-0 top-[7px] h-[2px]"
                        style={{
                          background:
                            "color-mix(in srgb, var(--spine) 72%, var(--ink))",
                        }}
                      />
                      <span
                        className="absolute inset-x-0 bottom-[20px] h-[2px]"
                        style={{
                          background:
                            "color-mix(in srgb, var(--spine) 72%, var(--ink))",
                        }}
                      />
                      <span
                        className="absolute bottom-[8px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-[1px] border"
                        style={{
                          borderColor:
                            "color-mix(in srgb, var(--spine) 60%, var(--ink))",
                        }}
                      />
                      <span
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to right, rgba(255,255,255,0.14), rgba(255,255,255,0) 20%, rgba(0,0,0,0) 74%, rgba(0,0,0,0.26))",
                        }}
                      />
                    </span>

                    <span
                      style={{ color: book.ink, fontSize }}
                      className="absolute inset-x-0 bottom-[24px] top-[10px] z-10 flex items-center justify-center [writing-mode:vertical-rl] font-semibold tracking-tight"
                    >
                      {label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/*
            The front lip, at z = 0 and last in the DOM, so it sits in front of
            the books' feet the way a real shelf edge does.
          */}
          <span
            aria-hidden
            className="absolute bottom-[-14px] left-0 top-0 w-[16px] rounded-b-[2px] bg-shelf-board-left"
          />
          <span
            aria-hidden
            className="absolute bottom-[-14px] right-0 top-0 w-[16px] rounded-b-[2px] bg-shelf-board-right"
          />
          {/*
            Inset between the uprights, the way a real carcass is built: the
            sides run the full height and the boards sit between them. Butting
            it over them instead reads as a picture frame rather than a shelf.

            **The lip is built the same way now, and wasn't.** It spanned the
            full width and painted over both uprights, so the carcass argued
            with itself — a board slotted between the sides at the top, and a
            strip laid across them at the bottom. At the bottom corner that
            read as the upright being cut off by something in front of it,
            which nothing at z = 0 can be. The uprights run 14px past the box
            to carry the plinth, and the lip is inset by their width.

            The inset shadows on its two ends draw the joint. Two boards
            meeting at right angles have gradients running at right angles too,
            so their values can't match all the way along the seam however
            they're tuned — and an unexplained mismatch reads as a mistake. A
            line reads as joinery.
          */}
          <span
            aria-hidden
            className="absolute left-[16px] right-[16px] top-0 h-[14px] bg-shelf-board-top shadow-[inset_1px_0_0_rgba(21,29,40,0.55),inset_-1px_0_0_rgba(21,29,40,0.55)]"
          />
          <span
            aria-hidden
            className="absolute left-[16px] right-[16px] top-full h-[14px] bg-shelf-lip shadow-[inset_1px_0_0_rgba(21,29,40,0.55),inset_-1px_0_0_rgba(21,29,40,0.55)]"
          />

          {/*
            The wires. Last in the DOM so they paint over the corner they land
            on, and `bottom-full` so each one stands on the top edge of an
            upright — 7px in, which is the middle of the 16px board.

            `preserve-3d` on the wire is what lets its anchor plate sit in the
            wall plane instead of lying along the cable: the plate carries the
            opposite rotation, which cancels the wire's and leaves it facing
            forward.
          */}
          {[
            { key: "left", pos: "left-[6px]" },
            { key: "right", pos: "right-[6px]" },
          ].map(({ key, pos }) => (
            <span
              key={key}
              aria-hidden
              className={`absolute bottom-full ${pos}`}
              style={{
                width: WIRE_W,
                height: WIRE_LEN,
                transformStyle: "preserve-3d",
                transformOrigin: "center bottom",
                transform: `translateZ(-${WIRE_FOOT_Z}px) rotateX(${WIRE_TILT}deg)`,
              }}
            >
              {/*
                **Two crossed blades, not one.** A single div is a flat tape:
                shade it however you like and it stays a tape, because rotating
                the scene by a degree changes nothing about its width. A second
                copy turned 90° about the rod's own long axis gives it a
                cross-section, so it occupies volume the way every other part
                of this shelf does — which is the whole reason the shelf reads
                as an object and the wire didn't.

                `rotateY` is the right axis because inside this wrapper the
                rod's length runs along the local Y. Both blades carry the same
                cylindrical shading, so whichever one you're closer to
                edge-on with, the other is showing you a lit round surface.
              */}
              <span className="absolute inset-0 bg-shelf-wire" />
              <span
                className="absolute inset-0 bg-shelf-wire"
                style={{ transform: "rotateY(90deg)" }}
              />

              {/*
                The ferrule where the rod enters the plank — same two crossed
                blades, same steel, just wider and short. Built the same way as
                the rod, so it is lit the same way and shares its axis.
              */}
              <span
                className="absolute bottom-0 left-1/2 h-[13px] w-[10px]"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "translate(-50%, 30%)",
                }}
              >
                <span className="absolute inset-0 rounded-[2px] bg-shelf-wire" />
                <span
                  className="absolute inset-0 rounded-[2px] bg-shelf-wire"
                  style={{ transform: "rotateY(90deg)" }}
                />
              </span>

              {/*
                The wall end: a bolt head, carrying the rod's rotation in
                reverse so it faces the viewer instead of lying along the rod.
                Without it the rod ends in mid-air.

                The shelf end has no separate fitting, and that is the fix
                rather than an omission. Three goes at one — a bolted plate, a
                hook, a ring — failed the same way: a part living in its own
                frame has to be lined up with the rod by hand, and at 11px
                being a pixel out reads as "not connected". The ferrule below
                is a CHILD of the rod, on the rod's own axis, so it cannot be
                out of line. Everything past it goes into the plank.
              */}
              <span
                className="absolute left-1/2 top-0 h-[10px] w-[10px] rounded-full bg-shelf-fitting ring-1 ring-shelf-edge/60"
                style={{
                  transform: `translate(-50%, -50%) rotateX(${-WIRE_TILT}deg)`,
                }}
              />
            </span>
          ))}

          {/*
            The shadow each rod casts where it enters the plank, lying in the
            plank's own plane — `bottom-full` and `rotateX(90deg)` like the
            ceiling, so it foreshortens with the surface it's painted on. It is
            the only thing here saying the rod meets the wood rather than
            hovering a pixel over it, which is what "not attached" was.
          */}
          {["left-[1px]", "right-[1px]"].map((pos) => (
            <span
              key={pos}
              aria-hidden
              className={`absolute bottom-full rounded-full bg-shelf-edge/75 blur-[3px] ${pos}`}
              style={{
                width: 15,
                height: WIRE_FOOT_Z + 10,
                transformOrigin: "center bottom",
                transform: "rotateX(90deg)",
              }}
            />
          ))}
        </div>
      </div>
      {/*
        Nothing at all until a book is picked — no `min-h`, and no element.
        There was a "Recent reads" caption here and it's gone at Bradley's
        request; removing only the text would have left this div in place with
        its own `mt-6`, so the gap would have stayed while the reason for it
        left. Rendering the whole wrapper conditionally is what actually
        recovers the space.

        The block therefore resizes when a book is clicked, which is the
        reader's own action rather than a cost paid on every page load to
        avoid it — the same reasoning that removed the 100px `min-h` before.
      */}
      <div className={selected ? "mt-6" : undefined}>
        {selected ? (
          <div className="flex gap-4">
            {/*
              The cover, and what makes a spine worth clicking. It appears
              only here — covers on the shelf itself would mean every book
              face-out, which is a display table rather than a shelf.

              Plain <img>: local, already sized to 260px tall, and routing
              eight small JPEGs through the Image Optimizer buys nothing.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.cover}
              alt={`${selected.title} cover`}
              className="h-[92px] w-auto shrink-0 rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[15px] leading-tight text-bright">
                  {selected.title}
                </span>
                <span
                  className={`label text-[10px] ${
                    selected.status === "reading" ? "text-live" : "text-muted"
                  }`}
                >
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <p className="t-meta mt-0.5">{selected.author}</p>
              {selected.note && (
                <p className="t-body mt-1.5">{selected.note}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
