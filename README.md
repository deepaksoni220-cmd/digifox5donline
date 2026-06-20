# Nimbus Aero — 3D Sneaker Product Page

A scroll-scrubbed 3D sneaker store built with **React Three Fiber**. One real 3D
shoe travels through a full shopping journey as the page scrolls — hero →
3-product grid → product detail → size / checkout — every frame driven by scroll
position (no timed animation, no animation libraries). In the size / checkout
section you can **grab the shoe and spin it a full 360°**.

## Quick start

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

## Build

```bash
npm run build      # type-checks, then builds to dist/
npm run preview    # preview the production build locally
```

## How it works

- A `position: sticky` stage is pinned inside a tall wrapper. One
  `requestAnimationFrame` loop reads how far the wrapper has scrolled (0 → 1),
  smooths it, and writes every DOM transform / opacity directly to the elements.
- The **same** smoothed progress value is read inside the `<Canvas>` via
  `useFrame`, so the shoe's position, scale and rotation are driven by scroll —
  never by a clock. The model is loaded once and cloned for the extra views.
- An orthographic camera gives the clean, flat product-render look.
- Soft floating shadows are cheap CSS radial gradients driven by the same
  progress value — no per-frame shadow maps.
- `prefers-reduced-motion` is honoured: the hero frame is held still.

Add `?card` to the URL to auto-play the whole journey on a loop (handy for a
preview thumbnail that can't be scrolled).

## Customising

All copy and pricing lives at the top of `src/AeroShowcase.tsx`:

```ts
const BRAND = "Nimbus";
const PRODUCT = "AERO";
const PRICE = "$180";
```

### Swap the shoe

Replace `public/objects/new_shoe.glb` with your own `.glb` model (or change
`MODEL_URL` in `src/AeroShowcase.tsx`). The model is auto-centred and scaled to
fit, so most exports drop in without changes. If a re-export faces the wrong
way, nudge the `SIDE` constant by `±Math.PI`.

The product grid and detail thumbnails use the PNGs in `public/`
(`grid-shoe-left.png`, `grid-shoe-right.png`, `thumb-1…4.png`) — swap those for
your own product imagery.

## Tech

React 19 · React Three Fiber 9 · three.js · TypeScript · Vite.

## License

You're free to use and adapt this template in your own projects.
