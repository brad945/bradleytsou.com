import { ImageResponse } from "next/og";
import BtMark from "@/components/BtMark";

/**
 * Favicon: Bradley's "bt." mark, generated rather than checked in as a binary.
 *
 * It replaced a "BT" monogram, which was two capitals in whatever face the
 * edge runtime defaults to — a placeholder, not a mark. The geometry lives in
 * `BtMark`, shared with the nav wordmark; this file is only the tile and the
 * placement.
 *
 * The mark is `bright` white on a `chrome` tile — the nav bar's own colour,
 * so this is literally the top-left wordmark on its own background.
 *
 * **The tile came back, and that reverses a call made here earlier.** This
 * was white on *transparent*, on the reasoning that the artwork's black field
 * read as a hard square on a light tab strip. What that costs only showed up
 * when Bradley looked at a search result: a pure white mark on no background
 * is invisible against anything light, which includes Google's result page in
 * its default light mode and half the browser chrome transparency was meant
 * to suit. An icon that can't be seen on light surfaces isn't a narrower
 * tradeoff than one that looks like a square — it's the same failure pointed
 * the other way. A rounded tile in the site's own colour is what the nav
 * already is, and it reads on everything.
 *
 * Literal hex because this runs in the edge runtime and can't import the
 * config — and `fill` is passed explicitly because Satori can't resolve
 * `currentColor`.
 */
/**
 * **48, not 32, and that is a fix rather than a preference.** Google's
 * favicon requirement is a square that's a multiple of 48px; at 32 it ignored
 * this one and drew the blank default circle beside the search result. The
 * tab strip renders it at 16 CSS px either way, so nothing visible here
 * changes — this is for the one reader that was rejecting it.
 */
export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        /*
           `chrome` #171a21, the global header's colour — the same field
           the nav's `bt.` sits on. Rounded rather than square, which is
           the shape every platform draws a favicon in anyway, and which
           was most of what made the old black tile read as a block.
        */
        background: "#171a21", // `chrome`
        borderRadius: 10,
      }}
    >
      {/*
       * Placed, not centred. Centring the mark's bounding box looks jammed
       * against the left edge, because the box's right side is set by the
       * period, alone down in the corner — so beside the b and t there is
       * nothing on the right, while the b's flat stem runs hard into the
       * margin.
       *
       * The ink's centre of mass is at 39.8% across, not 50%. Pure mass
       * centring puts the period on the edge, so this splits the difference
       * and leaves more room on the left than the right. Vertical stays
       * box-centred — the mark is only lopsided horizontally.
       *
       * 38x27 of the 48px tile. The mark is 1.4:1, so width sets the size
       * and the leftover is vertical by definition. These are the 32px
       * tile's 25x18 at left 5 / top 7, scaled by the same 1.5 the tile
       * grew by and rounded to whole pixels — the placement was tuned by
       * eye at the old size and this keeps it rather than re-deriving it.
       */}
      <BtMark
        width={38}
        height={27}
        fill="#ffffff" // `bright`
        style={{ position: "absolute", left: 7, top: 10 }}
      />
    </div>,
    size,
  );
}
