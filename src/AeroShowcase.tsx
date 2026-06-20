import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useCart } from "./state/CartContext";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────
   AERO — a scroll-scrubbed 3D shoe product page.
   (Template-based; edited for digifox + cart/checkout integration.)
   ──────────────────────────────────────────────────────────────────────── */

// Brand + product copy — edit these to rebrand the template.
const BRAND = "digifox";
const PRODUCT = "AERO";
const PRICE = "₹1700";

const MODEL_URL = "/objects/new_shoe.glb";

// ── math helpers ──────────────────────────────
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const seg = (p: number, start: number, end: number) =>
  p <= start ? 0 : p >= end ? 1 : (p - start) / (end - start);

type KF = { fx: number; fy: number; s: number; rx: number; ry: number; rz: number };
const mixKF = (a: KF, b: KF, t: number): KF => ({
  fx: lerp(a.fx, b.fx, t),
  fy: lerp(a.fy, b.fy, t),
  s: lerp(a.s, b.s, t),
  rx: lerp(a.rx, b.rx, t),
  ry: lerp(a.ry, b.ry, t),
  rz: lerp(a.rz, b.rz, t),
});

const SIDE = Math.PI;

const HERO: KF = { fx: 0.62, fy: 0.5, s: 0.9, rx: -0.15, ry: SIDE - 0.5, rz: 0.25 };
const GRID: KF = { fx: 0.5, fy: 0.36, s: 0.34, rx: 0.12, ry: SIDE - 0.12, rz: 0.0 };
const DETAIL: KF = { fx: 0.18, fy: 0.3, s: 0.32, rx: 0.04, ry: SIDE, rz: 0.0 };
const CHECKOUT: KF = { fx: 0.27, fy: 0.45, s: 0.6, rx: 0.1, ry: SIDE + 0.6, rz: -0.1 };

const mainKF = (p: number): KF => {
  if (p < 0.2) return HERO;
  if (p < 0.4) return mixKF(HERO, GRID, easeInOut(seg(p, 0.2, 0.4)));
  if (p < 0.6) return mixKF(GRID, DETAIL, easeInOut(seg(p, 0.4, 0.6)));
  return mixKF(DETAIL, CHECKOUT, easeInOut(seg(p, 0.6, 0.8)));
};

const floatAmt = (p: number) => lerp(1, 0.18, clamp(seg(p, 0.4, 0.6), 0, 1));

const sideKF = (p: number, left: boolean): { kf: KF; op: number } => {
  const t = easeOut(seg(p, 0.24, 0.4));
  const out = easeOut(seg(p, 0.42, 0.52));
  const fx = left ? 0.22 : 0.78;
  const enter: KF = { fx, fy: 1.25, s: 0.27, rx: 0.12, ry: SIDE - 0.1, rz: 0 };
  const rest: KF = { fx, fy: 0.36, s: 0.29, rx: 0.1, ry: SIDE - 0.1, rz: 0 };
  return { kf: mixKF(enter, rest, t), op: t * (1 - out) };
};

type GalleryDef = { kf: KF };
const GALLERY: GalleryDef[] = [
  { kf: { fx: 0.38, fy: 0.3, s: 0.32, rx: 0.18, ry: SIDE + 0.5, rz: 0 } },
  { kf: { fx: 0.18, fy: 0.7, s: 0.32, rx: 0.2, ry: 0.4, rz: -0.1 } },
  { kf: { fx: 0.38, fy: 0.7, s: 0.32, rx: -1.5, ry: SIDE, rz: 0 } },
];

const galleryOp = (p: number) => {
  const fadeIn = easeOut(seg(p, 0.5, 0.62));
  const fadeOut = easeInOut(seg(p, 0.6, 0.8));
  return fadeIn * (1 - fadeOut);
};

type ProgRef = MutableRefObject<number>;
type InterRef = MutableRefObject<boolean>;

// Build clone with clean materials for stable opacity.
function useInstance(scene: THREE.Group, fadeable = false) {
  return useMemo(() => {
    const clone = scene.clone(true);
    const mats: THREE.Material[] = [];
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        const src = m.material as THREE.MeshStandardMaterial;
        const mat = new THREE.MeshStandardMaterial({
          map: src.map ?? null,
          normalMap: src.normalMap ?? null,
          roughnessMap: src.roughnessMap ?? null,
          metalnessMap: src.metalnessMap ?? null,
          emissiveMap: src.emissiveMap ?? null,
          emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0x000000),
          color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
          roughness: src.roughness ?? 1,
          metalness: src.metalness ?? 0,
          side: THREE.DoubleSide,
        });

        mat.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            "#include <map_fragment>\n  diffuseColor.a = opacity;"
          );
        };
        mat.transparent = fadeable;
        mat.depthWrite = true;
        mat.alphaTest = 0;
        mat.needsUpdate = true;
        m.material = mat;
        mats.push(mat);
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    clone.position.sub(center);

    const wrap = new THREE.Group();
    wrap.add(clone);
    wrap.scale.setScalar(1 / maxDim);
    return { object: wrap, mats };
  }, [scene]);
}

const setOpacity = (mats: THREE.Material[], o: number) => {
  for (const m of mats) m.opacity = o;
};

const placeFromKF = (
  group: THREE.Group,
  kf: KF,
  vw: number,
  vh: number,
  floatY = 0
) => {
  group.position.set((kf.fx - 0.5) * vw, (0.5 - kf.fy) * vh + floatY, 0);
  group.scale.setScalar(kf.s * vh);
  group.rotation.set(kf.rx, kf.ry, kf.rz);
};

const DRAG_FROM = 0.65;

function MainShoe({
  scene,
  progress,
  interacted,
}: {
  scene: THREE.Group;
  progress: ProgRef;
  interacted: InterRef;
}) {
  const ref = useRef<THREE.Group>(null);
  const inst = useInstance(scene);
  const gl = useThree((s) => s.gl);
  const drag = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    ry: 0,
    rx: 0,
    demoStart: 0,
  });

  useEffect(() => {
    const el = gl.domElement;
    const d = drag.current;

    const down = (e: PointerEvent) => {
      if (progress.current < DRAG_FROM) return;
      d.dragging = true;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      interacted.current = true;
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!d.dragging) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.ry += dx * 0.01;
      d.rx = clamp(d.rx - dy * 0.01, -1.0, 1.0);
    };
    const up = () => {
      if (!d.dragging) return;
      d.dragging = false;
      el.style.cursor = progress.current >= DRAG_FROM ? "grab" : "";
    };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl, progress, interacted]);

  useFrame(({ viewport, clock }) => {
    const g = ref.current;
    if (!g) return;
    const p = progress.current;
    const kf = mainKF(p);
    const floatY =
      Math.sin(clock.elapsedTime * 0.8) * 0.02 * viewport.height * floatAmt(p);

    placeFromKF(g, kf, viewport.width, viewport.height, floatY);

    const d = drag.current;
    let demoRy = 0;

    if (p < DRAG_FROM) {
      d.ry += (0 - d.ry) * 0.1;
      d.rx += (0 - d.rx) * 0.1;
      d.demoStart = 0;
    } else if (!interacted.current && !d.dragging) {
      if (d.demoStart === 0) d.demoStart = clock.elapsedTime + 0.45;
      const t = clock.elapsedTime - d.demoStart;
      if (t > 0) {
        const decay = Math.max(0, 1 - t / 5.5);
        demoRy = Math.sin(t * 1.9) * 0.6 * decay * decay;
      }
    }

    if (!d.dragging) {
      gl.domElement.style.cursor = p >= DRAG_FROM ? "grab" : "";
    }

    g.rotation.set(kf.rx + d.rx, kf.ry + d.ry + demoRy, kf.rz);
    setOpacity(inst.mats, 1);
  });

  return (
    <group ref={ref}>
      <primitive object={inst.object} />
    </group>
  );
}

function GalleryShoe({
  scene,
  progress,
  def,
}: {
  scene: THREE.Group;
  progress: ProgRef;
  def: GalleryDef;
}) {
  const ref = useRef<THREE.Group>(null);
  const inst = useInstance(scene, true);

  useFrame(({ viewport, clock }) => {
    const g = ref.current;
    if (!g) return;
    const op = galleryOp(progress.current);
    const bob =
      Math.sin(clock.elapsedTime * 0.7 + def.kf.fx * 6) * 0.006 * viewport.height;
    placeFromKF(g, def.kf, viewport.width, viewport.height, bob);
    g.visible = op > 0.01;
    setOpacity(inst.mats, op);
  });

  return (
    <group ref={ref}>
      <primitive object={inst.object} />
    </group>
  );
}

function Scene({ progress, interacted }: { progress: ProgRef; interacted: InterRef }) {
  const { scene } = useGLTF(MODEL_URL);

  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight intensity={0.6} groundColor={new THREE.Color("#f6dcd8")} />
      <directionalLight position={[-5, 6, 4]} intensity={1.5} />
      <directionalLight position={[4, 2, 6]} intensity={0.7} color="#ffffff" />
      <directionalLight position={[2, -3, 2]} intensity={0.25} color="#ffd9d2" />
      <MainShoe scene={scene} progress={progress} interacted={interacted} />
      {GALLERY.map((def, i) => (
        <GalleryShoe key={i} scene={scene} progress={progress} def={def} />
      ))}
    </>
  );
}

const SIZES = ["6", "6.5", "7", "8", "9", "10", "11", "12"];

// Landing UX state
function useSelectedSize() {
  const [selectedSize, setSelectedSize] = useState(SIZES[3]); // default US 8
  return { selectedSize, setSelectedSize };
}

export default function AeroShowcase() {
  const { addItem } = useCart();
  const progress = useRef(0);
  const interacted = useRef(false);

  const { selectedSize, setSelectedSize } = useSelectedSize();
  const selectedVariantName = useMemo(
    () => `${BRAND} ${PRODUCT} US ${selectedSize}`,
    [selectedSize],
  );

  // Thumbnail UI state (shows active thumb border; GLB switch not possible
  // in this project because only one GLB is present).
  const [thumbIndex, setThumbIndex] = useState(0);
  const thumbSources = ["/thumb-1.png", "/thumb-2.png", "/thumb-3.png", "/thumb-4.png"];
  const [heroColorIndex, setHeroColorIndex] = useState(0);
  const [heroTab, setHeroTab] = useState<"Overview" | "Specs" | "Reviews">("Overview");
  const heroImage = thumbSources[heroColorIndex] ?? thumbSources[0];

  // DOM refs driven by rAF loop
  const pinRef = useRef<HTMLElement | null>(null);
  const cardPinkRef = useRef<HTMLDivElement>(null);
  const cardWhiteRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);
  // Cart actions are template-level: when user clicks “Select”, we add the
  // selected product variant to cart.
  const galleryFramesRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const mainShadowRef = useRef<HTMLDivElement>(null);
  const rotateHintRef = useRef<HTMLDivElement>(null);
  const sideImgLeftRef = useRef<HTMLImageElement>(null);
  const sideImgRightRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const card = new URLSearchParams(window.location.search).has("card");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const set = (
      el: HTMLElement | null,
      opacity: number,
      ty = 0,
      extra = "",
    ) => {
      if (!el) return;
      el.style.opacity = String(opacity);
      el.style.transform = `translate3d(0,${ty}px,0) ${extra}`.trim();
    };

    // Write every DOM layer for a given master progress p (0→1).
    const apply = (p: number) => {
      // card background: pink hero/grid → white detail/checkout (panel slides up)
      const white = easeInOut(seg(p, 0.4, 0.55));
      if (cardWhiteRef.current) {
        cardWhiteRef.current.style.transform = `translate3d(0,${lerp(101, 0, white)}%,0)`;
        cardWhiteRef.current.style.opacity = "1";
      }
      if (cardPinkRef.current) cardPinkRef.current.style.opacity = String(1 - white * 0.0);

      // huge AERO word — only in the hero, drifts up as it leaves
      const heroOut = easeInOut(seg(p, 0.2, 0.36));
      set(wordRef.current, (1 - heroOut) * 0.13, lerp(0, -40, heroOut), "scale(" + lerp(1, 1.04, heroOut) + ")");

      // hero UI layer
      set(heroRef.current, 1 - heroOut, lerp(0, -24, heroOut));

      // Interaction layers:
      // - In hero phase, hero controls (tabs/colors) should be clickable.
      // - In checkout phase, size + add-to-bag should be clickable.
      const heroInteractive = p < 0.62;
      const checkoutInteractive = p >= 0.62;

      if (heroRef.current) heroRef.current.style.pointerEvents = heroInteractive ? "auto" : "none";
      if (checkoutRef.current) checkoutRef.current.style.pointerEvents = checkoutInteractive ? "auto" : "none";

      // grid UI layer — in over hero→grid, out as the white panel rises
      const gridIn = easeOut(seg(p, 0.24, 0.4));
      const gridOut = easeInOut(seg(p, 0.42, 0.52));
      set(gridRef.current, gridIn * (1 - gridOut), lerp(20, 0, gridIn) + lerp(0, -20, gridOut));

      // arrow rides along under the focus shoe through hero + grid
      set(arrowRef.current, (1 - heroOut * 0) * (1 - gridOut), 0);
      const arrowVis = clamp(1 - easeInOut(seg(p, 0.42, 0.5)), 0, 1);
      if (arrowRef.current) arrowRef.current.style.opacity = String(arrowVis);

      // white-card gallery frames (left column) + detail / checkout panels
      const galleryIn = easeOut(seg(p, 0.5, 0.64));
      set(galleryFramesRef.current, galleryIn, lerp(16, 0, galleryIn));

      const detailIn = easeOut(seg(p, 0.52, 0.64));
      const detailOut = easeInOut(seg(p, 0.62, 0.74)); // hands off to checkout
      set(detailRef.current, detailIn * (1 - detailOut), lerp(24, 0, detailIn) + lerp(0, -20, detailOut));

      const checkoutIn = easeOut(seg(p, 0.72, 0.86));
      set(checkoutRef.current, checkoutIn, lerp(24, 0, checkoutIn));

      // "Drag to rotate" hint — rides in with the checkout panel, vanishes the
      // moment the user has grabbed the shoe (interacted). CSS handles the fade.
      if (rotateHintRef.current) {
        rotateHintRef.current.style.opacity = interacted.current ? "0" : String(checkoutIn);
      }

      // main floating shadow — follows the focus shoe's x/scale, softer on white
      if (mainShadowRef.current) {
        const kf = mainKF(p);
        const onWhite = white;
        
        // Hero physics: shift under the downward toe, make it shorter (don't stick out the back)
        // Interpolate exactly along with the HERO -> GRID shoe transition (p: 0.2 -> 0.4)
        const isHero = 1 - easeInOut(seg(p, 0.2, 0.4));
        const shadowLeft = kf.fx + lerp(0, 0.05, isHero);
        const shadowWidth = kf.s * lerp(130, 75, isHero);
        const baseOp = lerp(0.5, 0.9, isHero);

        mainShadowRef.current.style.left = `${shadowLeft * 100}%`;
        mainShadowRef.current.style.top = `${Math.min(kf.fy + kf.s * 0.35, 0.94) * 100}%`;
        mainShadowRef.current.style.width = `${shadowWidth}%`;
        mainShadowRef.current.style.opacity = String(lerp(baseOp, 0, onWhite));
        mainShadowRef.current.style.transform = `translate(-50%,-50%) scaleY(${lerp(0.34, 0.26, onWhite)})`;
      }

      // side grid images — same keyframes as the old SideShoe R3F components
      const { kf: lkf, op: lop } = sideKF(p, true);
      const { kf: rkf, op: rop } = sideKF(p, false);
      for (const [ref, kf, op] of [
        [sideImgLeftRef, lkf, lop],
        [sideImgRightRef, rkf, rop],
      ] as const) {
        const el = ref.current;
        if (!el) continue;
        el.style.opacity = String(op);
        el.style.left = `${kf.fx * 100}%`;
        el.style.top = `${kf.fy * 100}%`;
        el.style.height = `${kf.s * 100}vh`;
        el.style.visibility = op > 0.01 ? "visible" : "hidden";
      }
    };

    let raf = 0;

    if (card && !reduced) {
      // thumbnail: slow ping-pong through the whole journey (can't scroll)
      const DUR = 11000; // 0→1
      const HOLD = 1100;
      const start = performance.now();
      const loop = (now: number) => {
        const cycle = DUR * 2 + HOLD * 2;
        let t = (now - start) % cycle;
        let p: number;
        if (t < HOLD) p = 0;
        else if ((t -= HOLD) < DUR) p = easeInOut(t / DUR);
        else if ((t -= DUR) < HOLD) p = 1;
        else p = easeInOut(1 - (t - HOLD) / DUR);
        progress.current = p;
        apply(p);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else if (reduced) {
      progress.current = 0;
      apply(0);
    } else {
      // standalone: progress = how far the pinned wrapper has scrolled, smoothed
      const loop = () => {
        const pin = pinRef.current;
        if (pin) {
          const dist = pin.offsetHeight - window.innerHeight;
          const target =
            dist > 0 ? clamp(-pin.getBoundingClientRect().top / dist, 0, 1) : 0;
          progress.current += (target - progress.current) * 0.12; // buttery scrub
          apply(progress.current);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="ae-root">
      <style>{css}</style>

      {/* Global header is rendered by AppLayout to avoid duplicate logos on home. */}

      {/* tall wrapper → scroll distance for the pinned stage */}
      <section className="ae-pin" ref={pinRef}>
        <div className="ae-stage">
          <div className="ae-card">
            {/* ── card backgrounds ── */}
            <div className="ae-bg-pink" ref={cardPinkRef} />
            <div className="ae-bg-white" ref={cardWhiteRef} />

            {/* huge product word, behind the shoe */}
            <div className="ae-word" ref={wordRef}>
              {PRODUCT}
            </div>

            {/* white-card gallery frames removed */}

            {/* soft floating shadow */}
            <div className="ae-shadow" ref={mainShadowRef} />

            {/* side grid images — replace the left/right 3D shoes */}
            <img ref={sideImgLeftRef} src="/grid-shoe-left.png" alt="" className="ae-side-img" />
            <img ref={sideImgRightRef} src="/grid-shoe-right.png" alt="" className="ae-side-img" />

            {/* ── 3D shoe layer ── */}
            <div className="ae-canvas">
              <Canvas
                dpr={[1, 1.75]}
                orthographic
                camera={{ position: [0, 0, 1000], zoom: 1, near: 0.1, far: 2000 }}
                gl={{ antialias: true, alpha: true }}
                frameloop="always"
              >
                <Suspense fallback={null}>
                  <Scene progress={progress} interacted={interacted} />
                </Suspense>
              </Canvas>
            </div>

            {/* ── HERO UI ── */}
            <div className="ae-hero" ref={heroRef}>
              <div className="ae-card-top">
                <div className="ae-tabs">
                  {(["Overview", "Specs", "Reviews"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={"ae-tab" + (heroTab === tab ? " ae-tab--on" : "")}
                      onClick={() => setHeroTab(tab)}
                      style={{ border: "none", background: "transparent", cursor: "pointer" }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ae-hero-left">
                <img src={heroImage} alt={`${PRODUCT} preview`} className="ae-hero-preview" />
                <p className="ae-eyebrow">New / Lifestyle</p>
                <h1 className="ae-title">
                  {BRAND} {PRODUCT}
                </h1>
                {heroTab === "Overview" && (
                  <p className="ae-desc">
                    Featherweight cushioning. Clean profile. Built to float.
                  </p>
                )}
                {heroTab === "Specs" && (
                  <p className="ae-desc">
                    Knit upper, responsive foam midsole, durable rubber outsole, and ergonomic ankle support.
                  </p>
                )}
                {heroTab === "Reviews" && (
                  <p className="ae-desc">
                    “Super comfortable and lightweight.” • “Looks premium and fits true to size.” • “Great daily wear shoe.”
                  </p>
                )}
                <div className="ae-colors">
                  {["#e53935", "#b2f7ef", "#ff8c42", "#c8a2ff"].map((color, i) => (
                    <button
                      key={color}
                      type="button"
                      className={"ae-dot" + (heroColorIndex === i ? " ae-dot--on" : "")}
                      style={{ background: color, border: "none", padding: 0 }}
                      aria-label={`Select color ${i + 1}`}
                      onClick={() => setHeroColorIndex(i)}
                    />
                  ))}
                </div>
              </div>

              <div className="ae-hero-price">
                <span className="ae-price-label">From</span>
                <span className="ae-price-val">{PRICE}</span>
                <button
                  className="ae-preorder"
                  type="button"
                  onClick={() =>
                    addItem({
                      id: `aero-${selectedVariantName}`,
                      name: selectedVariantName,
                      price: 1700,
                    })
                  }
                >
                  Pre Order
                </button>
              </div>
            </div>

            {/* ── GRID UI ── */}
            <div className="ae-grid" ref={gridRef}>
              <div className="ae-col" style={{ left: "22%" }}>
                <span className="ae-col-name">{PRODUCT} Low</span>
                <span className="ae-col-sub">Lifestyle</span>
                <span className="ae-col-price">₹2000</span>
                <span className="ae-col-btn">View</span>
              </div>
              <div className="ae-col ae-col--center" style={{ left: "50%" }}>
                <span className="ae-col-name">{PRODUCT}</span>
                <span className="ae-col-sub">Signature</span>
                <span className="ae-col-price">{PRICE}</span>
                <button
                  type="button"
                  className="ae-col-btn ae-col-btn--on"
                  onClick={() => {
                    // Select just moves focus to the size section (no cart add).
                    checkoutRef.current?.scrollIntoView?.({ behavior: "smooth" });
                  }}
                >
                  Select
                </button>
              </div>
              <div className="ae-col" style={{ left: "78%" }}>
                <span className="ae-col-name">{PRODUCT} High</span>
                <span className="ae-col-sub">Performance</span>
                <span className="ae-col-price">₹2100</span>
                <span className="ae-col-btn">View</span>
              </div>
            </div>

            {/* ── DETAIL UI ── */}
            <div className="ae-detail" ref={detailRef}>
              <h2 className="ae-d-title">
                {BRAND} {PRODUCT}
              </h2>
              <p className="ae-d-cat">Lifestyle / Low</p>
              <p className="ae-d-price">{PRICE}</p>
              <p className="ae-d-para">
                Precision-knit upper over a soft foam midsole. Designed in studio and
                rendered live, every angle of the {PRODUCT} in one clean view.
              </p>
              <div className="ae-d-tabs">
                <span className="ae-d-tab ae-d-tab--on">Inspiration</span>
                <span className="ae-d-tab">Your Designs</span>
              </div>
              <div className="ae-d-thumbs">
                {thumbSources.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    className={"ae-d-thumb" + (i === thumbIndex ? " ae-d-thumb--on" : "")}
                    aria-label={`Preview ${i + 1}`}
                    onClick={() => setThumbIndex(i)}
                    style={{
                      backgroundImage: `url(${src})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ── CHECKOUT UI ── */}
            <div className="ae-checkout" ref={checkoutRef}>
              <div className="ae-co-head">
                <h2 className="ae-co-title">Select Size</h2>
                <span className="ae-co-guide">Size Guide</span>
              </div>
              <div className="ae-co-sizes">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={"ae-co-size" + (s === selectedSize ? " ae-co-size--on" : "")}
                    onClick={() => setSelectedSize(s)}
                    aria-label={`Select size US ${s}`}
                    style={{ cursor: "pointer" }}
                  >
                    US {s}
                  </button>
                ))}
              </div>
              <div className="ae-co-actions">
                <button className="ae-co-customize" type="button">
                  Customize
                </button>
                <button
                  className="ae-co-bag"
                  type="button"
                  onClick={() =>
                    addItem({
                      id: `aero-${selectedVariantName}`,
                      name: selectedVariantName,
                      price: 1700,
                    })
                  }
                >
                  Add to Bag
                </button>
              </div>
              <p className="ae-co-note">Free returns within 30 days.</p>
            </div>

            {/* "drag to rotate" hint — sits over the shoe, never blocks the drag */}
            <div className="ae-rotate-hint" ref={rotateHintRef} aria-hidden>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v4.5h-4.5" />
              </svg>
              <span>Drag to rotate</span>
            </div>

            {/* downward arrow */}
            <div className="ae-arrow" ref={arrowRef} aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="m6 13 6 6 6-6" />
              </svg>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

useGLTF.preload(MODEL_URL);

const css = `
.ae-root{
  --blush:#f6dcd8;
  --ink:#1d1a1c;
  position:relative;width:100%;background:var(--blush);
  font-family:'Inter',system-ui,-apple-system,sans-serif;color:var(--ink);
}
.ae-root *{box-sizing:border-box;margin:0;padding:0;}
.ae-pin{position:relative;width:100%;height:560svh;}
.ae-stage{position:sticky;top:0;height:100svh;width:100%;
  display:flex;align-items:center;justify-content:center;overflow:hidden;}
.ae-card{position:relative;width:100%;height:100svh;overflow:hidden;isolation:isolate;}
.ae-bg-pink,.ae-bg-white{position:absolute;inset:0;}
.ae-bg-pink{
  background:
    radial-gradient(120% 90% at 18% 8%, rgba(255,255,255,.6), transparent 46%),
    radial-gradient(120% 120% at 88% 96%, rgba(231,150,170,.55), transparent 55%),
    linear-gradient(150deg,#fbe4e0 0%,#f6cdd5 52%,#efb9c8 100%);
  z-index:1;
}
.ae-bg-white{
  background:linear-gradient(180deg,#fffdfc,#fcf7f6);
  transform:translate3d(0,101%,0);z-index:6;
  box-shadow:0 -20px 40px -24px rgba(120,60,70,.25);
}
.ae-word{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-left:clamp(60px,14vw,200px);
  z-index:2;font-weight:800;letter-spacing:-.04em;color:#b34a63;
  font-size:clamp(120px,26vw,360px);line-height:.8;opacity:.13;
  pointer-events:none;user-select:none;will-change:transform,opacity;
}
.ae-side-img{
  position:absolute;z-index:9;width:auto;object-fit:contain;
  transform:translate(-50%,-50%);pointer-events:none;
  opacity:0;visibility:hidden;will-change:left,top,height,opacity;
}
.ae-shadow{position:absolute;z-index:8;width:30%;height:60px;
  background:radial-gradient(closest-side, rgba(20,5,10,.85) 10%, rgba(60,20,30,.4) 45%, transparent 80%);
  transform:translate(-50%,-50%) scaleY(.32);pointer-events:none;
  will-change:left,top,width,opacity,transform;filter:blur(3px);}
.ae-canvas{position:absolute;inset:0;z-index:9;pointer-events:none;}
.ae-canvas canvas{display:block;width:100%!important;height:100%!important;}
.ae-hero,.ae-grid,.ae-detail,.ae-checkout{
  position:absolute;inset:0;z-index:12;will-change:transform,opacity;
}
.ae-grid,.ae-detail,.ae-checkout{opacity:0;}
.ae-card-top{position:absolute;top:0;left:0;right:0;z-index:20;
  display:flex;align-items:center;justify-content:center;
  padding:clamp(84px,10vh,112px) clamp(16px,2.6vw,28px) clamp(12px,2.4vh,22px);}
.ae-tabs{display:flex;gap:4px;padding:4px;border-radius:999px;
  background:rgba(255,255,255,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}
.ae-tab{font-size:11px;font-weight:500;color:#9a5566;padding:4px 12px;border-radius:999px;}
.ae-hero-preview{
  width: min(280px, 32vw);
  border-radius: 16px;
  border: 1px solid rgba(29,26,28,.08);
  background: rgba(255,255,255,.35);
  margin-bottom: 12px;
}
.ae-tab--on{background:#fff;color:#1d1a1c;box-shadow:0 2px 8px rgba(120,60,70,.18);}
.ae-hero-left{position:absolute;left:clamp(18px,3vw,40px);top:56%;transform:translateY(-50%);
  width:min(40%,360px);z-index:2;}
.ae-eyebrow{font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#b85f72;}
.ae-title{margin-top:8px;font-size:clamp(24px,3.4vw,46px);font-weight:700;letter-spacing:-.03em;line-height:1.0;color:#2a1f23;}
.ae-desc{
  margin-top:12px;
  font-size:clamp(11px,1vw,13.5px);
  line-height:1.55;
  color:#1d1a1c;
  max-width:30ch;
  background:rgba(255,255,255,.58);
  border:1px solid rgba(29,26,28,.08);
  border-radius:12px;
  padding:8px 10px;
  -webkit-backdrop-filter:blur(3px);
  backdrop-filter:blur(3px);
}
.ae-colors{display:flex;gap:9px;margin-top:14px;}
.ae-dot{width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);cursor:pointer;}
.ae-dot--on{box-shadow:0 0 0 2px #fff,0 0 0 3.5px #2a1f23;}
.ae-hero-price{position:absolute;right:clamp(18px,3vw,40px);bottom:clamp(16px,3vh,30px);
  display:flex;flex-direction:column;align-items:flex-end;gap:6px;z-index:2;}
.ae-price-label{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#b85f72;}
.ae-price-val{font-size:clamp(22px,2.6vw,34px);font-weight:700;letter-spacing:-.02em;color:#2a1f23;line-height:.9;}
.ae-preorder{margin-top:6px;font-family:inherit;font-size:13px;font-weight:600;color:#fff;
  background:#2a1f23;border:none;border-radius:999px;padding:11px 26px;cursor:pointer;
  box-shadow:0 12px 26px -10px rgba(42,31,35,.7);transition:transform .15s ease;}
.ae-grid,.ae-detail{pointer-events:none;}
.ae-checkout{pointer-events:none;z-index:30;}
.ae-checkout button,.ae-co-size,.ae-co-guide,.ae-d-tab,.ae-d-thumb{pointer-events:auto;}
.ae-col{position:absolute;top:58%;transform:translateX(-50%);
  display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;z-index:2;}
.ae-col-name{font-size:clamp(13px,1.4vw,18px);font-weight:700;letter-spacing:-.02em;color:#2a1f23;}
.ae-col-sub{font-size:10.5px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#b06579;}
.ae-col-price{font-size:13px;font-weight:600;color:#5d434b;margin-top:1px;}
.ae-col-btn{margin-top:8px;font-size:11.5px;font-weight:600;color:#5d434b;
  padding:6px 18px;border-radius:999px;border:1px solid rgba(122,51,70,.3);background:rgba(255,255,255,.45);}
.ae-col-btn--on{background:#2a1f23;color:#fff;border-color:#2a1f23;}
.ae-detail,.ae-checkout{padding:clamp(18px,3vh,32px) clamp(22px,4vw,52px);}
.ae-d-title{position:absolute;right:clamp(22px,4vw,52px);top:clamp(98px,12vh,134px);width:min(44%,420px);
  text-align:left;font-size:clamp(22px,2.8vw,40px);font-weight:700;letter-spacing:-.03em;color:#1d1a1c;line-height:1;}
.ae-d-cat{position:absolute;right:clamp(22px,4vw,52px);top:clamp(138px,20vh,184px);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#9a9498;width:min(44%,420px);}
.ae-d-price{position:absolute;right:clamp(22px,4vw,52px);top:clamp(166px,24vh,214px);font-size:clamp(18px,2vw,26px);font-weight:700;color:#1d1a1c;width:min(44%,420px);}
.ae-d-para{position:absolute;right:clamp(22px,4vw,52px);top:clamp(210px,33vh,280px);width:min(44%,420px);font-size:clamp(11px,1vw,13.5px);line-height:1.6;color:#6b6569;}
.ae-d-tabs{position:absolute;right:clamp(22px,4vw,52px);bottom:clamp(78px,20vh,130px);display:flex;gap:18px;}
.ae-d-tab{font-size:12.5px;font-weight:600;color:#9a9498;padding-bottom:6px;}
.ae-d-tab--on{color:#1d1a1c;border-bottom:2px solid #1d1a1c;}
.ae-d-thumbs{position:absolute;right:clamp(22px,4vw,52px);bottom:clamp(26px,7vh,52px);display:flex;gap:10px;}
.ae-d-thumb{width:clamp(44px,5vw,64px);height:clamp(44px,5vw,64px);border-radius:12px;background:#f4eeed;border:1px solid rgba(29,26,28,.08);}
.ae-d-thumb--on{border:2px solid #1d1a1c;}
.ae-checkout{z-index:30;}
.ae-co-head{position:absolute;right:clamp(22px,4vw,52px);top:clamp(98px,12vh,134px);width:min(46%,440px);display:flex;align-items:baseline;justify-content:space-between;}
.ae-co-title{position:static;font-size:clamp(20px,2.4vw,32px);font-weight:700;letter-spacing:-.02em;color:#1d1a1c;}
.ae-co-guide{font-size:12px;font-weight:500;color:#9a9498;text-decoration:underline;text-underline-offset:3px;}
.ae-co-sizes{position:absolute;right:clamp(22px,4vw,52px);top:clamp(148px,21vh,204px);width:min(46%,440px);display:grid;grid-template-columns:repeat(3,1fr);gap:9px;}
.ae-co-size{height:clamp(34px,5vh,44px);display:grid;place-items:center;border-radius:11px;font-size:12.5px;font-weight:600;color:#3a353a;background:#f6f1f0;border:1px solid rgba(29,26,28,.1);}
.ae-co-size--on{background:#1d1a1c;color:#fff;border-color:#1d1a1c;}
.ae-co-actions{position:absolute;right:clamp(22px,4vw,52px);bottom:clamp(44px,12vh,80px);width:min(46%,440px);display:flex;gap:10px;}
.ae-co-customize{flex:none;width:38%;height:46px;border-radius:13px;font-family:inherit;font-size:13px;font-weight:600;color:#1d1a1c;background:#fff;border:1px solid rgba(29,26,28,.22);cursor:pointer;}
.ae-co-bag{flex:1;height:46px;border-radius:13px;font-family:inherit;font-size:13px;font-weight:600;color:#fff;background:#1d1a1c;border:none;cursor:pointer;}
.ae-co-note{position:absolute;right:clamp(22px,4vw,52px);bottom:clamp(22px,6vh,46px);font-size:11px;color:#9a9498;width:min(46%,440px);}
.ae-rotate-hint{
  position:absolute;left:27%;top:78%;transform:translate(-50%,-50%);
  z-index:12;display:flex;align-items:center;gap:8px;white-space:nowrap;
  padding:8px 14px 8px 11px;border-radius:999px;
  background:rgba(255,255,255,.6);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  border:1px solid rgba(29,26,28,.1);font-size:12px;font-weight:600;color:#5d434b;
  opacity:0;pointer-events:none;transition:opacity .45s ease;
}
.ae-arrow{position:absolute;left:50%;bottom:clamp(12px,2.4vh,22px);transform:translateX(-50%);z-index:8;color:#9a5566;}

@media (max-width:760px){
  .ae-card-top{
    top: env(safe-area-inset-top, 0);
    padding-top: max(10px, env(safe-area-inset-top, 0));
    z-index: 40;
  }

  .ae-hero{
    z-index: 35;
  }

  .ae-hero-left{
    left: 50%;
    right: auto;
    top: clamp(104px, 18vh, 146px);
    transform: translateX(-50%);
    width: min(92vw, 360px);
    max-width: 360px;
    z-index: 44;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .ae-hero-preview{
    width: min(44vw, 160px);
    margin-bottom: 10px;
  }

  .ae-title{
    font-size: clamp(22px, 8.4vw, 34px);
    line-height: 1.02;
  }

  .ae-desc{
    display:block;
    font-size: clamp(11px, 3.3vw, 13px);
    max-width: 36ch;
  }

  .ae-colors{
    margin-top: 10px;
  }

  .ae-canvas{
    top: 88px;
  }

  .ae-grid .ae-col{
    top: 64%;
  }

  .ae-d-title{ top: clamp(56px, 10vh, 86px); }
  .ae-d-cat{ top: clamp(98px, 17vh, 142px); }
  .ae-d-price{ top: clamp(122px, 21vh, 172px); }
  .ae-d-para{ top: clamp(166px, 30vh, 236px); }

  .ae-co-head{ top: clamp(56px, 10vh, 86px); }
  .ae-co-sizes{ top: clamp(108px, 18vh, 158px); }

  .ae-hero-price{
    right: 16px;
    bottom: clamp(16px, 3.2vh, 28px);
    z-index: 36;
  }
}
`;
