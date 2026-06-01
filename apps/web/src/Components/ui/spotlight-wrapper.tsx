/**
 * Spotlight — a zero-layout-impact cursor-following glow wrapper.
 *
 * Tracks pointer position and overlays an absolutely-positioned radial-gradient
 * glow (pointer-events: none) clipped to the card's border-radius. The wrapper
 * adds NO padding, margin, background, or border of its own — so the wrapped
 * card is visually pixel-identical to unwrapped except for the spotlight on hover.
 *
 * Usage:
 *   <Spotlight radius={12}>          ← rounded-xl cards (12 px)
 *     <div className="...card...">…</div>
 *   </Spotlight>
 *
 *   <Spotlight radius={8}>           ← rounded-lg stripe cards (8 px)
 *     …
 *   </Spotlight>
 *
 * Layout note: the wrapper is `position: relative; overflow: hidden` and takes
 * the same block/inline size as its child (no extra spacing). For flex/grid
 * children that already stretch to fill, this is transparent.  If the child has
 * an explicit height you must pass the same sizing class via `className` so the
 * wrapper matches (e.g. className="h-full").
 */
import { useRef, useEffect, type ReactNode, type CSSProperties } from "react";

interface SpotlightProps {
  children: ReactNode;
  /** Border-radius in px — must match the wrapped card's rounded-* class.
   *  rounded-xl = 12, rounded-lg = 8, rounded-2xl = 16. Default: 12. */
  radius?: number;
  /** HSL hue base for the spotlight colour (default 160 = Stitcher green #19E5A1). */
  hueBase?: number;
  /** HSL hue spread: shifts the hue across the horizontal axis (default 0 = solid colour). */
  hueSpread?: number;
  /** Extra Tailwind classes forwarded to the wrapper div (e.g. "h-full flex-1"). */
  className?: string;
}

export function Spotlight({
  children,
  radius = 12,
  hueBase = 160,
  hueSpread = 0,
  className = "",
}: SpotlightProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const xp = Math.max(0, Math.min(1, x / rect.width));
      const hue = (hueBase + xp * hueSpread).toFixed(1);

      el.style.setProperty("--sp-x", `${x}px`);
      el.style.setProperty("--sp-y", `${y}px`);
      el.style.setProperty("--sp-hue", hue);
      el.style.setProperty("--sp-opacity", "1");
    };

    const onLeave = () => el.style.setProperty("--sp-opacity", "0");

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [hueBase, hueSpread]);

  const overlayStyle: CSSProperties = {
    // CSS custom properties with fallbacks — updated imperatively by the
    // pointer handler so React never re-renders on mouse move.
    position: "absolute",
    inset: 0,
    borderRadius: radius,
    pointerEvents: "none",
    zIndex: 20,
    // Spotlight fill — soft radial gradient centred on the cursor.
    // Stitcher green (#19E5A1 ≈ hsl(160 80% 55%)), brightness reduced 20%
    // (fill alpha 0.10 → 0.08).
    background: `radial-gradient(
      160px 160px at var(--sp-x, 50%) var(--sp-y, 50%),
      hsl(var(--sp-hue, ${hueBase}) 80% 55% / 0.08) 0%,
      transparent 80%
    )`,
    // Border accent ring — very subtle, adds depth without overriding child border
    // (ring alpha 0.30 → 0.24, also -20%).
    boxShadow: `inset 0 0 0 1px hsl(var(--sp-hue, ${hueBase}) 75% 50% / 0.24)`,
    opacity: "var(--sp-opacity, 0)" as unknown as number,
    transition: "opacity 0.25s ease",
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden ${className}`}
      style={
        {
          borderRadius: radius,
          "--sp-opacity": "0",
        } as CSSProperties
      }
    >
      {/* Pointer-events-none overlay: fills the wrapper, clipped by overflow:hidden */}
      <div aria-hidden="true" style={overlayStyle} />
      {children}
    </div>
  );
}
