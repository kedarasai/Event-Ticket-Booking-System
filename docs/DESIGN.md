# Ticket Booking System - Design System & UI Specification

## Compatibility
- **React**: `19.3.1`
- **React DOM**: `19.3.1`
- **React Router DOM**: `7.18.4`
- **Rules**:
  - Use ONLY APIs valid for these exact versions (e.g., standard React 19 hooks and JSX, React Router v7 `BrowserRouter`, `Routes`, `Route`, `Link`, `useNavigate`, `useLocation`, `useParams`).
  - Make all code safe under React StrictMode (double-invoked effects): abort fetches, clear timers and listeners, and never duplicate side effects.
  - Zero external UI/animation/3D/icon libraries: plain CSS, CSS variables, CSS 3D transforms, and inline SVG icons only.

---

## 1. Theme
- **Background**: `#07070d`
- **Surface Levels**:
  - Surface 1: `rgba(255, 255, 255, 0.04)`
  - Surface 2: `rgba(255, 255, 255, 0.06)`
  - Surface 3: `rgba(255, 255, 255, 0.09)`
- **Border**: `rgba(255, 255, 255, 0.12)`
- **Text**:
  - Primary text: `#ecebf5`
  - Muted text: `#a3a3bd`
- **Accent Gradient**: `#7c3aed` -> `#22d3ee`
- **Semantic Colors**:
  - Success: `#34d399`
  - Warning: `#fbbf24`
  - Danger: `#f43f5e`
  - Gold (selected seats / highlights): `#fbbf24`
- **Border Radii**:
  - Small: `8px` (`--radius-sm`)
  - Medium: `14px` (`--radius-md`)
  - Large: `22px` (`--radius-lg`)
  - Full (pill): `9999px` (`--radius-full`)
- **Spacing Scale**: Base 4px (`--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`, `--space-10: 40px`, `--space-12: 48px`, `--space-16: 64px`).
- **Shadows**:
  - Soft: `0 8px 32px 0 rgba(0, 0, 0, 0.37)`
  - Glow Violet: `0 0 24px rgba(124, 58, 237, 0.35)`
  - Glow Cyan: `0 0 24px rgba(34, 211, 238, 0.35)`
  - Glow Gold: `0 0 24px rgba(251, 191, 36, 0.45)`
- **Fonts**:
  - Headings: `'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
  - Body: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
  - Loaded via Google Fonts `<link>` with `display=swap`, plus full system-font fallback stacks for offline resilience.
- **Type Scale with clamp()**:
  - `h1`: `clamp(2.4rem, 5vw, 4.2rem)`
  - `h2`: `clamp(1.7rem, 3vw, 2.4rem)`
  - `h3`: `1.25rem`
  - `body`: `1rem`
  - `small`: `0.875rem`

---

## 2. Recipes
- **(a) Glass (`.glass`)**:
  - Background: Surface 2 (`rgba(255, 255, 255, 0.06)`)
  - Border: `1px solid rgba(255, 255, 255, 0.12)`
  - Backdrop filter: `-webkit-backdrop-filter: blur(16px) saturate(140%); backdrop-filter: blur(16px) saturate(140%);`
  - Inset top highlight: `box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.12), 0 8px 32px 0 rgba(0, 0, 0, 0.37);`
- **(b) Gradient Border (`.gradient-border`)**:
  - Achieved via `::before` pseudo-element with `padding: 1px`, `background: linear-gradient(135deg, #7c3aed, #22d3ee)`, and `mask-composite: exclude` (with `-webkit-mask` / `-webkit-mask-composite: xor` fallback).
- **(c) Page Background (`.page-background`)**:
  - Base color `#07070d`.
  - 3 fixed radial-gradient glows (violet `#7c3aed`, cyan `#22d3ee`, magenta `#ec4899`).
  - Subtle 4% noise overlay using an inline SVG data URI.
  - Slow drift animated using `transform: translate(...)` on a pseudo-element, never animating `background-position`.

---

## 3. Layout
- **Container**: `max-width: 1200px` with fluid responsive padding (`clamp(1rem, 4vw, 2rem)`).
- **Breakpoints (mobile-first)**:
  - Mobile: `< 480px`
  - Tablet Portrait: `>= 480px`
  - Tablet Landscape / Small Desktop: `>= 768px`
  - Desktop: `>= 1024px`
  - Wide Desktop: `>= 1280px`
- **Touch / Tap Targets**: `>= 44px` for all interactive elements.
- **Horizontal Scroll**: Strict `overflow-x: hidden` prevention — no horizontal page scroll at any viewport width.

---

## 4. Motion
- **Timing Tokens**:
  - `--dur-fast`: `150ms`
  - `--dur`: `300ms`
  - `--dur-slow`: `600ms`
  - `--ease-out`: `cubic-bezier(0.22, 1, 0.36, 1)`
- **Keyframes**:
  - `fade-up`: `from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); }`
  - `scale-in`: `from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); }`
  - `shimmer`: `background-position: -200% 0` to `200% 0`
  - `float`: subtle periodic Y-axis floating `translateY(0)` -> `translateY(-6px)` -> `translateY(0)`
  - `glow-pulse`: pulsing opacity / box-shadow of accent glows
  - `spin`: `rotate(0deg)` to `rotate(360deg)`
- **Stagger Effect**:
  - Apply with inline style `style={{ '--i': index }}` and CSS `animation-delay: calc(var(--i) * 60ms)`.
- **Scroll Reveal**:
  - `useReveal` hook utilizing `IntersectionObserver`.
- **Route Transitions**:
  - Keyed wrapper with `fade-up 300ms`.
- **Performance Rule**:
  - Animate ONLY `transform` and `opacity`.
- **Accessibility (`prefers-reduced-motion`)**:
  - Automatically disables automatic motion (float, parallax, shimmer, confetti, decorative intros).
  - Keeps user-driven functional transitions (e.g. instant or subtle clicks).

---

## 5. Accessibility
- **Focus Rings**: `:focus-visible` with `outline: 2px solid #22d3ee` and `outline-offset: 2px`.
- **Contrast**: Text contrast meets WCAG AA standards (minimum 4.5:1 for normal text, 3:1 for large text).
- **Keyboard Navigation**: Every button, input, tab, and seat is fully keyboard operable (`Tab`, `Space`, `Enter`, Arrow keys).
- **Live Regions**: `aria-live="polite"` for non-disruptive notifications / toasts; `role="status"`.

---

## 6. CSS 3D Rules (Critical)
1. **Perspective Container**: Place `perspective: 1000px` (or desired depth) on a dedicated parent wrapper.
2. **Preserve 3D Chain**: Every element between the perspective parent and any 3D child must have `transform-style: preserve-3d`.
3. **Avoid Flattening Properties**:
   - `overflow` other than `visible`
   - `filter`
   - `backdrop-filter`
   - `mask`
   - `clip-path`
   - `opacity < 1`
   - `mix-blend-mode`
   - Any of these properties on an element IN the 3D chain flattens the 3D rendering context into a 2D plane!
   - Keep these properties strictly on leaf elements or outside the 3D chain.
4. **Backface Visibility**: Use `backface-visibility: hidden` for flip cards and rotated 3D surfaces.
5. **Pointer-Driven Orbit / Tilt**:
   - Drive pointer-based motion by writing CSS variables (e.g. `--tilt`, `--yaw`, `--zoom`) directly onto a ref'd element inside `requestAnimationFrame`, NEVER through React component state.
6. **Hardware Acceleration**: Use `will-change: transform` sparingly and only during active gesture interactions.

---

## 7. Seat Map 3D Specification
- **Coordinates & Orientation**:
  - Floor plane: CSS XY plane (`x` across the venue, `y` depth away from stage, `translateZ` = elevation).
  - Scene transforms: `rotateX(var(--tilt)) rotateY(var(--yaw)) scale(var(--zoom))`.
  - Defaults: `--tilt: 52deg`, `--yaw: 0deg`, `--zoom: 1`.
  - Limits:
    - Tilt: `35deg` to `65deg`
    - Yaw: `-35deg` to `+35deg`
    - Zoom: `0.7` to `1.4`
- **Seat Architecture**:
  - Each seat is a small 3D chair composed of a horizontal cushion (`rotateX(90deg)`) plus a vertical backrest (`translateZ(...)`), both with gradient faces.
  - **Seat States**:
    - **AVAILABLE**: Cyan accent (`#22d3ee`), subtle glow on hover.
    - **HOVER**: Violet highlight (`#7c3aed`), scale `1.08`.
    - **SELECTED**: Gold (`#fbbf24`), prominent glow (`box-shadow: 0 0 16px rgba(251, 191, 36, 0.7)`), raised by `translateZ(14px)`.
    - **BOOKED**: Dark muted (`#3b3b4f`), opacity `0.45`, `pointer-events: none` / unclickable.
- **Stage**:
  - Glowing slab located at the front of the venue with projected light beams.
- **Geometry**:
  - Rows are curved in an arc (`translate(...) rotateZ(...)`).
  - Tiered seating: each successive row is slightly higher (`translateZ`) than the previous one.
  - Aisle gap inserted every 4 seats.
- **Gesture Threshold**:
  - Pointer down to pointer up distance:
    - Drag `< 4px`: treated as seat click / toggle.
    - Drag `>= 4px`: treated as 3D orbit / tilt gesture.

---

## 8. Browser Support
- Target: Latest Chrome, Edge, Firefox, Safari.
- Always include `-webkit-` vendor prefixes for `-webkit-backdrop-filter` and `-webkit-mask` / `-webkit-mask-composite`.
