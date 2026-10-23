import { inventory, rarityTile } from "@/lib/about-data";

/**
 * Real objects as an inventory grid.
 *
 * **This is where the `rarity` field finally renders again.** The Item
 * Showcase used it to rank projects and was deleted; the field stayed in the
 * data with nothing showing it. Here it answers a different question — how
 * much of his life the thing takes up, not how central it is to his work —
 * which is the same split as the two pages.
 *
 * Tiles are monogram capsules built from the palette, the way every capsule on
 * this site is. A monogram isn't self-describing the way item art is, so the
 * name and a line of detail sit under each one rather than in a `title`, which
 * never fires on touch anyway.
 */
export default function Inventory() {
  return (
    <section aria-labelledby="inventory-heading" className="panel">
      <div className="panel-bar">
        <h2 id="inventory-heading" className="panel-bar-title">
          Inventory
        </h2>
        <span className="panel-bar-meta">{inventory.length} items</span>
      </div>

      <div className="p-5">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {inventory.map((item) => {
            const tile = rarityTile[item.rarity];
            return (
              <li key={item.name} className="flex gap-3">
                <span
                  aria-hidden
                  className={`solid solid-thin solid-edged flex h-[52px] w-[52px] shrink-0 items-center justify-center border bg-panel2/70 text-[14px] font-light ${tile}`}
                >
                  {item.code}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] leading-tight text-ink">
                    {item.name}
                  </span>
                  <span className="t-meta mt-0.5 block leading-snug">
                    {item.note}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {/*
          Says what rarity means here, because it means something different
          from the same word on the profile page and nothing else would say so.
        */}
        <p className="t-meta mt-5 border-t border-line/50 pt-4">
          Outline colour is how much of my life it takes up, not what it cost.
        </p>
      </div>
    </section>
  );
}
