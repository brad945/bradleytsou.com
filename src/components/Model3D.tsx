"use client";

import {
  ContactShadows,
  Environment,
  Float,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * A spinning 3D model, built the way ayushbhujle.com builds his.
 *
 * ## What that site actually runs, measured rather than guessed
 *
 * react-three-fiber + drei, loading an **11.4 MB `.glb`** of a Celsius can,
 * with `<Environment />` fetching a studio HDRI from a GitHub CDN at runtime.
 * The same four pieces are here: a Canvas, an environment map, contact shadows
 * and orbit controls.
 *
 * One thing his does that this doesn't: mount unconditionally. With WebGL
 * unavailable his canvas never mounts and half the hero is blank — verified,
 * it took running Chrome with software rendering to see his model at all.
 * `/play` renders a fallback instead.
 *
 * ## Two geometries, one component
 *
 * `src` loads a `.glb` through `useGLTF`, exactly as he does. With no `src`
 * it extrudes the site's own `bt.` mark instead, which needs **no downloaded
 * asset at all** — the source is ~200 bytes of path data and the mesh is built
 * in the browser. That's the default because his single model file is ten
 * times this entire `public/` folder and 125x its largest asset, and because a
 * stock object says nothing about whose site it is.
 *
 * Drop a file in `public/models/` and pass `src="/models/thing.glb"` to swap.
 * Run it through `gltf-transform optimize` first — Draco plus WebP textures
 * routinely takes 10 MB under 1 MB.
 */

/** The `b`, copied from `BtMark.tsx`. See the note on `MARK_SVG`. */
const B = [
  "M0 0 H70 V281 H0 Z",
  "M50.5 198 A75.5 87 0 1 1 201.5 198 A75.5 87 0 1 1 50.5 198 Z",
  "M69.5 198 A29.5 33 0 1 0 128.5 198 A29.5 33 0 1 0 69.5 198 Z",
].join(" ");

/**
 * The whole mark as one SVG document, which is what `SVGLoader` parses.
 *
 * `BtMark` draws the `t` as two `<rect>`s and the period as a `<circle>`, and
 * SVGLoader handles both, so they're copied verbatim rather than re-expressed.
 *
 * **This duplicates `BtMark.tsx` and shouldn't stay that way.** If this
 * graduates past a prototype the path data moves to one module both import;
 * it's duplicated now so an experiment touches nothing that ships.
 */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 408 292">
  <path d="${B}" />
  <rect x="196" y="116" width="127" height="55" />
  <rect x="226" y="58" width="67" height="223" />
  <circle cx="365" cy="250" r="42" />
</svg>`;

const MARK_URL = `data:image/svg+xml;utf8,${encodeURIComponent(MARK_SVG)}`;

/**
 * Spins its children on Y — or rocks them, which for a wordmark is better.
 *
 * **A full turn is wrong for a logo and right for a can.** The reference site
 * spins a drinks can, which reads the same from every angle. Sampled six
 * frames across one rotation of this mark and it reads as "bt." in two of
 * them: the rest are the mirrored back ("`.td`") or, once, edge-on and nearly
 * invisible. `sweep` instead turns it to a limit and back, so it never passes
 * behind itself and the mark is always legible.
 *
 * `mode="spin"` is the reference's behaviour, kept because that's what was
 * asked for; `"rock"` is the default because it's the one that suits what this
 * particular object is.
 */
function Spin({
  mode = "rock",
  speed = 0.5,
  sweep = 0.55,
  children,
}: {
  mode?: "spin" | "rock";
  speed?: number;
  /** Radians either side of front, for `rock`. 0.55 ≈ 32°. */
  sweep?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  /*
   * `delta` rather than a fixed step per frame, so the speed is the same on a
   * 60Hz laptop and a 120Hz phone. A `+= 0.01` here would run at double rate
   * on the phone, which is the usual way this gets written and is wrong.
   *
   * `rock` accumulates elapsed time rather than reading the clock, so that
   * OrbitControls dragging it doesn't fight an absolute target — the two
   * compose instead.
   */
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!ref.current) return;
    if (mode === "spin") {
      ref.current.rotation.y += delta * speed;
    } else {
      t.current += delta * speed;
      ref.current.rotation.y = Math.sin(t.current) * sweep;
    }
  });
  return <group ref={ref}>{children}</group>;
}

function GltfModel({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  /*
   * Cloned, because `useGLTF` caches by URL and hands every caller the same
   * object — mutating its transform would move it for anyone else rendering
   * the same file. Cheap here, and it stops a bug that only shows up the
   * second time the model is used.
   */
  const model = useMemo(() => scene.clone(), [scene]);

  /*
   * Fit to a 3-unit box and centre on the origin, so any file lands at a
   * sensible size no matter what units it was authored in — a Blender export
   * in centimetres and one in metres differ by 100x, and hardcoding a scale
   * per model is how that becomes a per-file fiddle.
   */
  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const s = 3 / Math.max(size.x, size.y, size.z);
    return { scale: s, offset: centre.multiplyScalar(-s) };
  }, [model]);

  return (
    <group scale={scale} position={offset.toArray()}>
      <primitive object={model} />
    </group>
  );
}

function ExtrudedMark() {
  /*
   * `useLoader` would work, but SVGLoader is synchronous on a data: URL and
   * going through Suspense for it buys nothing. Parsing here keeps the whole
   * geometry inside one `useMemo`.
   */
  const geometry = useMemo(() => {
    const data = new SVGLoader().parse(
      decodeURIComponent(MARK_URL.split(",")[1]),
    );
    const geos: THREE.ExtrudeGeometry[] = [];
    for (const path of data.paths) {
      /*
       * `createShapes` is what turns a filled path into shapes *with holes* —
       * the b's counter is a real hole in the 2D mark, done by winding, and it
       * has to stay one here or the letterform fills in.
       */
      for (const shape of SVGLoader.createShapes(path)) {
        geos.push(
          new THREE.ExtrudeGeometry(shape, {
            depth: 52,
            bevelEnabled: true,
            bevelThickness: 6,
            bevelSize: 5,
            bevelSegments: 4,
            curveSegments: 28,
          }),
        );
      }
    }
    return geos;
  }, []);

  /*
   * SVG's y axis points down and three.js's points up, so the mark arrives
   * upside down — hence the negative y scale rather than a rotation. The
   * position then centres the 408x292 viewBox, whose origin is its top left;
   * without it the mark orbits a corner instead of spinning in place.
   */
  return (
    <group scale={[0.0115, -0.0115, 0.0115]} position={[-2.35, 1.68, -0.3]}>
      {geometry.map((geo, i) => (
        <mesh key={i} geometry={geo} castShadow receiveShadow>
          {/*
            Near-mirror metal, which is only worth doing *because* there's an
            environment map — `metalness: 1` with nothing to reflect renders as
            flat black. The polish on the reference site is mostly this pairing
            rather than anything about its model.
          */}
          <meshStandardMaterial
            color="#dfe6ee"
            metalness={0.92}
            roughness={0.18}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function Model3D({
  src,
  mode,
  className,
}: {
  /** A `.glb` in `public/`. Omit to spin the extruded `bt.` mark instead. */
  src?: string;
  /** `"spin"` for a full turn, as the reference site does. See `Spin`. */
  mode?: "spin" | "rock";
  className?: string;
}) {
  return (
    <div className={className}>
      <Canvas
        shadows
        /*
          Capped at 2. The default is the device's own ratio, and on a 3x phone
          that's nine times the pixels for no visible gain.
        */
        dpr={[1, 2]}
        camera={{ position: [0, 0.6, 6.4], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/*
          Everything below Suspense: the environment map and any `.glb` are
          both fetched, and without a boundary the first frame throws.
        */}
        <Suspense fallback={null}>
          {/*
            The environment map, and the single biggest reason his looks
            polished. Metal is only shiny if it has something to reflect —
            without this, `metalness: 0.92` renders as flat black.

            `preset="studio"` is what the reference site uses, and it fetches
            ~1 MB from a GitHub CDN at runtime. `background={false}` so it
            lights the model without painting the page behind it.
          */}
          <Environment preset="studio" background={false} />

          {/*
            Float gives it a slow bob independent of the spin, so the motion
            doesn't read as a turntable. Small amounts — this sits next to a
            site whose brief bans decorative animation.
          */}
          <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.4}>
            <Spin mode={mode}>
              {src ? <GltfModel src={src} /> : <ExtrudedMark />}
            </Spin>
          </Float>

          {/*
            The shadow the object drops on the floor, which is what stops it
            reading as a sticker on a flat background. `blur` high and `opacity`
            low, because a hard shadow under a floating object is the wrong
            claim — nothing here is sitting on anything.
          */}
          <ContactShadows
            position={[0, -1.9, 0]}
            opacity={0.45}
            scale={11}
            blur={2.6}
            far={4.5}
          />
        </Suspense>

        {/*
          Drag to rotate, as his does. Zoom and pan are off: this is one object
          in a fixed frame, and letting a reader pan it out of view is a way to
          break the page rather than a feature. `autoRotate` stays off because
          `Spin` already owns the rotation, and two of them fight.
        */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={(Math.PI * 2) / 3}
        />
      </Canvas>
    </div>
  );
}
