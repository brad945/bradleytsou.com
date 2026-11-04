"use client";

import {
  ContactShadows,
  Environment,
  Float,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
 * The `t`, and the period with it.
 *
 * `BtMark` draws the `t` as two `<rect>`s and the period as a `<circle>`, and
 * SVGLoader handles both, so they're copied verbatim rather than
 * re-expressed.
 *
 * **The dot rides with the `t` rather than being dropped or given a column of
 * its own.** Splitting a three-glyph mark in two leaves it somewhere, and
 * `bt.` without its period is a different wordmark — one the favicon, the nav
 * and the footer would all still be drawing. It sits low and right of the
 * stem, which is where it sits in the mark.
 */
const T = `<rect x="196" y="116" width="127" height="55" />
  <rect x="226" y="58" width="67" height="223" />
  <circle cx="365" cy="250" r="42" />`;

/**
 * The mark as an SVG document, which is what `SVGLoader` parses — whole, or
 * one half of it.
 *
 * The viewBox is the same either way and deliberately so: nothing downstream
 * reads it, because `ExtrudedMark` centres on the geometry's own bounds. What
 * it does buy is that the two halves come out at **the same scale as each
 * other and as the whole mark**, since they're cut from one coordinate system
 * rather than fitted individually.
 *
 * **This duplicates `BtMark.tsx` and shouldn't stay that way.** If this
 * graduates past a prototype the path data moves to one module both import;
 * it's duplicated now so an experiment touches nothing that ships.
 */
function markSvg(glyph?: Glyph) {
  const body =
    glyph === "b"
      ? `<path d="${B}" />`
      : glyph === "t"
        ? T
        : `<path d="${B}" />
  ${T}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 408 292">
  ${body}
</svg>`;
}

/** Which half of the mark to extrude. Omitted means all of it. */
export type Glyph = "b" | "t";

/**
 * How far `follow` turns the model at full cursor deflection, in radians.
 *
 * **Set in degrees, by Bradley, after four rounds of nudging it in ratios.**
 * "make it 15 to 40" — 40° of yaw and 15° of pitch, which is what 0.70 and
 * 0.26 are here. The constants stay in radians because that is what three.js
 * rotations take; the degrees are the spec, so convert from them rather than
 * scaling these numbers if it moves again.
 *
 * The history, because it explains why this ended up stated outright. The
 * split came with "increase the 'mouse cursor following' for both once u
 * separate them": 0.85 / 0.35 to 1.3 / 0.55, or 74.5° and 31.5°. Then "reduce
 * the multiplier" — 0.75x, to 56.1° / 23.5°. Then "a bit less" — to 48.7° /
 * 20.1°, the pre-split pair. Then this. **Every round but the first went
 * down**, so the raise that came with the split was simply wrong, and the
 * ratio steps were a slow way of finding that out. Don't re-derive it by
 * scaling; 40 / 15 is the asked-for value.
 *
 * **Those degree figures are the achieved maximum, not just the constant in
 * other units, and that is only true because `aim` is clamped to ±1.** The
 * target is `aim.x * FOLLOW_YAW` and the lerp below eases toward it without
 * overshooting (`k` is capped at 1), so the clamp is what makes the multiplier
 * and the limit the same number. Take the clamp out — the raw ratio runs past
 * 1 once the pointer is beyond half a viewport from a canvas's centre — and
 * every angle quoted here becomes a floor instead of a ceiling.
 *
 * What bounds the yaw is legibility rather than geometry: past about 80° an
 * extruded letterform is edge-on and reads as a bar, and at 90° it is gone.
 * 74.5° was close to that edge on purpose; 40° is half of it, so what limits
 * this knob now is taste rather than the letterform.
 */
const FOLLOW_YAW = 0.7; // 40°
const FOLLOW_PITCH = 0.26; // 15°

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
  mode?: "spin" | "rock" | "follow";
  speed?: number;
  /** Radians either side of front, for `rock`. 0.55 ≈ 32°. */
  sweep?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const { gl } = useThree();

  /*
   * Where the pointer is **relative to the model**, not to the page.
   *
   * The first version normalised against the viewport, which is only the same
   * thing for a model in the middle of it. This one sits in a 305px column
   * down the left edge, so the cursor was to its right essentially always and
   * the mark just held a rightward lean — it tracked, but it never looked at
   * you. Measuring from the canvas's own centre means straight ahead when the
   * cursor is on it, and turning either way from there.
   *
   * Still listening on `window` rather than on the canvas: R3F's own
   * `state.pointer` updates only while the pointer is *over* the canvas, and
   * this one is a narrow strip, so the model would freeze the moment you moved
   * onto the content — which is most of the time.
   *
   * **Measuring per canvas is also the whole of why a split mark mirrors for
   * free**, and it's worth not undoing. Two halves in the two black columns
   * sit at mirrored x, so `aim.x` for one is the negative of `aim.x` for the
   * other under a mirrored cursor — measured at 1600 wide, centres 153 and
   * 1448: a cursor at 800 reads +0.809 / -0.809, at 200 reads +0.059 /
   * -1.559, and at 1400 the same two numbers swapped. Each half therefore
   * turns toward the cursor and the pair is symmetric about the page, which
   * is what "a reflection" means. A `mirror` flag negating one half's yaw was
   * written first and was exactly wrong: it made both turn the *same* way.
   *
   * Half the viewport is the distance at which it reaches full turn. A ref
   * rather than state because this changes on every move and nothing renders
   * on it.
   */
  const aim = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (mode !== "follow") return;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onMove = (e: PointerEvent) => {
      /*
       * Read per move rather than cached: the canvas slides into place on
       * reveal and moves again on resize, and a stale centre would leave the
       * model aiming at where it used to be.
       */
      const r = gl.domElement.getBoundingClientRect();
      aim.current = {
        x: clamp(
          (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2),
        ),
        y: clamp(
          (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2),
        ),
      };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [mode, gl]);
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
      return;
    }
    if (mode === "follow") {
      /*
       * Eased toward the target rather than set to it, so the mark swings
       * after the cursor instead of being welded to it — the lag is what makes
       * it feel like an object being turned rather than a slider.
       *
       * The damping is scaled by `delta` so it settles at the same rate
       * whatever the frame rate. `Math.min(1, …)` because a long frame (a tab
       * regaining focus) would otherwise overshoot past the target and snap.
       */
      const k = Math.min(1, delta * 4);
      ref.current.rotation.y +=
        (aim.current.x * FOLLOW_YAW - ref.current.rotation.y) * k;
      ref.current.rotation.x +=
        (aim.current.y * FOLLOW_PITCH - ref.current.rotation.x) * k;
      return;
    }
    t.current += delta * speed;
    ref.current.rotation.y = Math.sin(t.current) * sweep;
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

/** World units per SVG unit. Fixed, not fitted — see `markSvg`. */
const MARK_SCALE = 0.0115;

function ExtrudedMark({ glyph }: { glyph?: Glyph }) {
  /*
   * `useLoader` would work, but SVGLoader is synchronous on a data: URL and
   * going through Suspense for it buys nothing. Parsing here keeps the whole
   * geometry inside one `useMemo`.
   */
  const geometry = useMemo(() => {
    const data = new SVGLoader().parse(markSvg(glyph));
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
  }, [glyph]);

  /*
   * Where the extruded glyphs actually are, so the group can be hung on their
   * own centre.
   *
   * **Measured rather than written, which it has to be now the mark can be
   * cut in half.** This was `position={[-2.35, 1.68, -0.3]}` — the centre of
   * the 408x292 viewBox, times the scale — and that is right for the whole
   * mark and wrong for either half of it, since the `b` fills the left of
   * that box and the `t` the right. A hardcoded offset would leave each half
   * orbiting a point out in space beside it. These come out at the old
   * numbers for the whole mark, which is how the swap was checked.
   */
  const centre = useMemo(() => {
    const box = new THREE.Box3();
    for (const geo of geometry) {
      geo.computeBoundingBox();
      if (geo.boundingBox) box.union(geo.boundingBox);
    }
    return box.getCenter(new THREE.Vector3());
  }, [geometry]);

  /*
   * SVG's y axis points down and three.js's points up, so the mark arrives
   * upside down — hence the negative y scale rather than a rotation. That is
   * also why the y offset is positive where the other two are negative: the
   * flip has already happened by the time the position applies.
   */
  return (
    <group
      scale={[MARK_SCALE, -MARK_SCALE, MARK_SCALE]}
      position={[
        -centre.x * MARK_SCALE,
        centre.y * MARK_SCALE,
        -centre.z * MARK_SCALE,
      ]}
    >
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
  glyph,
  zoom = 1,
  onReady,
  onPick,
  className,
}: {
  /** A `.glb` in `public/`. Omit to spin the extruded `bt.` mark instead. */
  src?: string;
  /**
   * Extrude one half of the mark instead of all of it — `"b"` or `"t"`, the
   * latter carrying the period. Ignored when `src` is set.
   */
  glyph?: Glyph;
  /**
   * `"rock"` turns and returns, `"spin"` is the reference site's full turn,
   * `"follow"` tracks the cursor. See `Spin`.
   */
  mode?: "spin" | "rock" | "follow";
  /** >1 pulls the camera back, making the model smaller in frame. */
  zoom?: number;
  /**
   * Fired once the renderer exists and has a frame.
   *
   * A caller that animates this into view needs it. `dynamic()` resolves the
   * chunk and mounts the component, but WebGL setup and the first render come
   * later — so a transition started on mount runs and finishes against an
   * empty canvas, and the model then appears at its destination having
   * travelled nowhere. That was exactly the bug: `MarkReveal` slid a box that
   * was still empty.
   */
  onReady?: () => void;
  /**
   * Fired when a click lands on the model's own geometry, and not before.
   *
   * **This exists because a canvas is a rectangle and a letterform isn't.**
   * The caller's box is as tall as the reveal needs, so wrapping it in a link
   * made every pixel of that box clickable — Bradley's words were "why can i
   * 'click them' when im not hovering directly over them". r3f raycasts the
   * meshes, so attaching the intent here instead means the empty space around
   * the glyph is genuinely inert, and the `b`'s counter is a hole that clicks
   * pass through for free because it is a real hole in the geometry.
   *
   * Handlers go on a group around the model alone, never the scene: the
   * contact shadow is a mesh too, and anything broader would make the shadow
   * clickable.
   */
  onPick?: () => void;
  className?: string;
}) {
  /*
   * Hover is tracked only to set the cursor, and it is set as an inline style
   * rather than a class because Tailwind's scanner reads this file as text —
   * a class name toggled at runtime is one it can't see. (The same rule as
   * the ternaries in `MarkReveal`.)
   */
  const [over, setOver] = useState(false);
  const pickable = !!onPick;

  return (
    <div
      className={className}
      style={pickable && over ? { cursor: "pointer" } : undefined}
    >
      <Canvas
        shadows
        /*
          Capped at 2. The default is the device's own ratio, and on a 3x phone
          that's nine times the pixels for no visible gain.
        */
        dpr={[1, 2]}
        camera={{ position: [0, 0.6 * zoom, 6.4 * zoom], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        /*
          `onCreated` fires after the renderer, scene and camera exist. One
          more frame on top of that, because the callback runs before anything
          has actually been drawn — a caller fading this in on `onCreated`
          alone still gets one blank frame.
        */
        onCreated={() => {
          if (onReady) requestAnimationFrame(() => onReady());
        }}
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
              {/*
                The pick target, and it is this group rather than anything
                larger on purpose — see `onPick`. Without a handler this is a
                plain group, so `/play` raycasts nothing and pays nothing.

                `stopPropagation` because r3f reports every mesh the ray
                crosses: an extruded glyph is several meshes deep at the
                bevels, so one click would otherwise fire once per hit.
              */}
              <group
                onClick={
                  pickable
                    ? (e) => {
                        e.stopPropagation();
                        onPick?.();
                      }
                    : undefined
                }
                onPointerOver={
                  pickable
                    ? (e) => {
                        e.stopPropagation();
                        setOver(true);
                      }
                    : undefined
                }
                onPointerOut={pickable ? () => setOver(false) : undefined}
              >
                {src ? <GltfModel src={src} /> : <ExtrudedMark glyph={glyph} />}
              </group>
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
        {/*
          Drag to rotate — but not in `follow`, where the two would fight over
          the same rotation every frame and the model would judder.
        */}
        {mode !== "follow" && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={(Math.PI * 2) / 3}
          />
        )}
      </Canvas>
    </div>
  );
}
