/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No `images.remotePatterns` on purpose: the only remote image is the GitHub
  // avatar and it's rendered `unoptimized`, so the Image Optimizer is never
  // asked to fetch a remote host.
  experimental: {
    /*
     * **Half of the fix for the font breaking in production; the other half,
     * and the load-bearing one, is that the three families are self-hosted
     * now — see `src/app/layout.tsx`.** `next/font` hashes the CSS it built to
     * name its classes and font families:
     *
     *   const fontFamilyHash = getHashDigest(Buffer.from(css), "sha1", "hex", 6)
     *
     * Both the server and the client compiler run that loader, and both have
     * to arrive at the same hash or the `__variable_*` class the server puts
     * on `<html>` names a rule the stylesheet never defines. So the loader
     * keeps a one-shot in-process cache, with this comment above it:
     *
     *   "Hacky way to make sure the fetch is only done once. Otherwise both
     *    the client and server compiler would fetch the CSS. The reason we
     *    need to return the actual CSS from both the server and client is
     *    because a hash is generated based on the CSS content."
     *
     * `webpackBuildWorker` runs those two compilers in **separate worker
     * processes**, so that cache is never hit: each one fetches Google
     * independently and the hashes agree only as long as the two responses
     * are byte-identical. On this project's Vercel builds they weren't — the
     * live HTML asked for `__variable_2fad4c` while the stylesheet beside it
     * defined `__variable_4dc837`, nothing matched, `--font-sans` resolved to
     * nothing and the whole site fell back to `system-ui`. The font *files*
     * were identical in both, which is what rules out the build cache and
     * points at the two fetches.
     *
     * It defaults on — `webpackBuildWorker || (undefined && !config.webpack)`
     * is true for any project without a custom `webpack` key — so turning it
     * off puts the two compilers back in one process, which is where that
     * cache was designed to work. With the fonts read off disk there is no
     * fetch left to share, so this is belt rather than braces: it is here so
     * that a future `next/font/google` call can't quietly reintroduce the
     * bug. The cost is that the two compilations no longer overlap, which on
     * a site this size is a few seconds of build time.
     *
     * Don't remove this without checking the live page: the `__variable_*`
     * names in the HTML must match the ones in the CSS file it links.
     */
    webpackBuildWorker: false,
  },
};

export default nextConfig;
