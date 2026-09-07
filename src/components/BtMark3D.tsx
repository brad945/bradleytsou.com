"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * The `bt.` mark, extruded and spinning. A prototype.
 *
 * ## Why this and not a downloaded model
 *
 * The reference site (ayushbhujle.com) spins an 11.4 MB `.glb` of a Celsius
 * can. Measured: that one file is **ten times this entire `public/` folder**
 * and 125x its largest asset. It is also, on a page about a person, a stock
 * object — the model is the interesting thing and it isn't his.
 *
 * This extrudes the site's own mark instead. The geometry is built from the
 * same path data `BtMark.tsx` draws, so:
 *   - **there is no model file at all** — the source is ~200 bytes of path
 *     strings, and the mesh is generated in the browser
 *   - it can't drift from the 2D mark, because it is the 2D mark
 *   - it's specific to this site rather than to a drinks brand
 *
 * The cost is the library, not the asset: three.js is ~170 KB gzipped after
 * tree-shaking. That is the entire price of this feature, and it is why this
 * lives on `/play` rather than on `/`, which loads 104 KB in total today.
 *
 * ## What is deliberately not here
 *
 * No `@react-three/drei`. It's the usual companion and it would have supplied
 * `<Environment />` and `<OrbitControls />` in one line each — but it also
 * fetches a 1 MB studio HDRI from a GitHub CDN at runtime (the reference site
 * does exactly this), and adds another ~200 KB. Three lights and twenty lines
 * of pointer maths cost nothing and fetch nothing.
 */

/** The `b`, from `BtMark.tsx`. Kept identical — see the note in `shapes`. */
const B = [
  "M0 0 H70 V281 H0 Z",
  "M50.5 198 A75.5 87 0 1 1 201.5 198 A75.5 87 0 1 1 50.5 198 Z",
  "M69.5 198 A29.5 33 0 1 0 128.5 198 A29.5 33 0 1 0 69.5 198 Z",
].join(" ");

/**
 * The whole mark as one SVG document, which is what `SVGLoader` parses.
 *
 * `BtMark` draws the `t` as two `<rect>`s and the period as a `<circle>`;
 * SVGLoader handles both, so they're copied across verbatim rather than
 * re-expressed as paths. The viewBox is the mark's own ink bounds.
 *
 * **This duplicates `BtMark.tsx`'s geometry and shouldn't stay that way.** If
 * this graduates past a prototype, the path data moves into one module both
 * import. Left duplicated for now so nothing shipping is touched by an
 * experiment.
 */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 408 292">
  <path d="${B}" />
  <rect x="196" y="116" width="127" height="55" />
  <rect x="226" y="58" width="67" height="223" />
  <circle cx="365" cy="250" r="42" />
</svg>`;

const MARK_URL = `data:image/svg+xml;utf8,${encodeURIComponent(MARK_SVG)}`;

function Mark({ spin }: { spin: boolean }) {
  const group = useRef<THREE.Group>(null);
  const data = useLoader(SVGLoader, MARK_URL);

  /*
   * One extruded geometry per sub-path, merged under a single group.
   *
   * `SVGLoader.createShapes` is what turns a filled path into `THREE.Shape`s
   * *with holes* — the b's bowl is a real counter in the 2D mark (done by
   * winding) and it has to stay one here, or the letterform fills in.
   *
   * `useMemo` because extrusion is not cheap and `useFrame` runs 60x a second;
   * rebuilding this per frame would be the whole performance budget.
   */
  const geometry = useMemo(() => {
    const geos: THREE.ExtrudeGeometry[] = [];
    for (const path of data.paths) {
      for (const shape of SVGLoader.createShapes(path)) {
        geos.push(
          new THREE.ExtrudeGeometry(shape, {
            depth: 46,
            bevelEnabled: true,
            bevelThickness: 5,
            bevelSize: 4,
            bevelSegments: 3,
            curveSegments: 24,
          }),
        );
      }
    }
    return geos;
  }, [data]);

  /*
   * SVG's y axis points down and three.js's points up, so the mark arrives
   * upside down — `scale-y: -1` is the fix, and it's why the group is scaled
   * negatively on one axis rather than rotated.
   *
   * Then centre it: the viewBox is 408x292 with its origin at the top left, so
   * without this the mark orbits a corner instead of spinning in place.
   */
  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.6;
  });

  return (
    <group ref={group}>
      <group scale={[0.011, -0.011, 0.011]} position={[-2.24, 1.6, -0.25]}>
        {geometry.map((geo, i) => (
          <mesh key={i} geometry={geo} castShadow>
            {/*
              Metallic, because the mark is the only bright thing in the frame
              and a flat material at this size reads as a sticker. `roughness`
              is high enough that it picks up the lights as broad sheens rather
              than hard specular dots, which need an environment map to look
              like anything.
            */}
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.6}
              roughness={0.35}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function BtMark3D({ className }: { className?: string }) {
  /*
   * Pause on hover, so a reader can look at it. The brief on this site bans
   * ambient decoration; a spin that stops when you point at it is at least
   * answering the pointer.
   */
  const [spin, setSpin] = useState(true);

  return (
    <div
      className={className}
      onPointerEnter={() => setSpin(false)}
      onPointerLeave={() => setSpin(true)}
    >
      {/*
        `dpr` capped at 2: the default is the device's own, and on a 3x phone
        that is 9x the pixels for no visible gain.

        `frameloop="demand"` is deliberately NOT set — that renders only when
        something changes, which is right for a static scene and wrong for one
        that spins every frame.
      */}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6.2], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/*
          Three lights, no environment map. Key from the top-left — the same
          source the shelf, the avatar frame and every book on this site are
          lit from, so this doesn't contradict the rest of the page.
        */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[-4, 5, 6]} intensity={2.4} />
        <directionalLight
          position={[5, -2, 3]}
          intensity={0.7}
          color="#66c0f4"
        />
        <Mark spin={spin} />
      </Canvas>
    </div>
  );
}
