import React, { useEffect, useRef, ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
}

const glowColorMap = {
  blue:   { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green:  { base: 120, spread: 200 },
  red:    { base: 0,   spread: 200 },
  orange: { base: 30,  spread: 200 },
};

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96',
};

const GlowCard: React.FC<GlowCardProps> = ({
  children,
  className = '',
  glowColor = 'blue',
  size = 'md',
  width,
  height,
  customSize = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Track position relative to THIS card, not the viewport.
    // background-attachment:fixed breaks inside CSS-transformed containers
    // (Radix Dialog uses translate(-50%,-50%)), so we use element-relative coords.
    const syncPointer = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--x', x.toFixed(2));
      card.style.setProperty('--xp', (x / rect.width).toFixed(2));
      card.style.setProperty('--y', y.toFixed(2));
      card.style.setProperty('--yp', (y / rect.height).toFixed(2));
    };

    document.addEventListener('pointermove', syncPointer);
    return () => document.removeEventListener('pointermove', syncPointer);
  }, []);

  const { base, spread } = glowColorMap[glowColor];

  const getInlineStyles = (): React.CSSProperties & Record<string, unknown> => {
    const baseStyles: React.CSSProperties & Record<string, unknown> = {
      '--base': base,
      '--spread': spread,
      '--radius': '14',
      '--border': '3',
      '--backdrop': 'hsl(0 0% 8% / 0.85)',
      '--backup-border': 'hsl(0 0% 100% / 0.08)',
      '--size': '220',
      '--outer': '1',
      '--border-size': 'calc(var(--border, 2) * 1px)',
      '--spotlight-size': 'calc(var(--size, 150) * 1px)',
      '--hue': 'calc(var(--base) + (var(--xp, 0.5) * var(--spread, 0)))',
      backgroundImage: `radial-gradient(
        var(--spotlight-size) var(--spotlight-size) at
        calc(var(--x, 50%) * 1px)
        calc(var(--y, 50%) * 1px),
        hsl(var(--hue, 210) calc(var(--saturation, 80) * 1%) calc(var(--lightness, 60) * 1%) / var(--bg-spot-opacity, 0.12)), transparent
      )`,
      backgroundColor: 'var(--backdrop, transparent)',
      border: 'var(--border-size) solid var(--backup-border)',
      position: 'relative' as const,
      touchAction: 'none' as const,
    };

    if (width !== undefined)  baseStyles.width  = typeof width  === 'number' ? `${width}px`  : width;
    if (height !== undefined) baseStyles.height = typeof height === 'number' ? `${height}px` : height;

    return baseStyles;
  };

  // No background-attachment:fixed — positions are element-relative now
  const beforeAfterStyles = `
    [data-glow-card]::before,
    [data-glow-card]::after {
      pointer-events: none;
      content: "";
      position: absolute;
      inset: calc(var(--border-size) * -1);
      border: var(--border-size) solid transparent;
      border-radius: calc(var(--radius) * 1px);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: 0 0;
      mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      mask-clip: padding-box, border-box;
      mask-composite: intersect;
    }

    [data-glow-card]::before {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
        calc(var(--x, 50%) * 1px)
        calc(var(--y, 50%) * 1px),
        hsl(var(--hue, 210) calc(var(--saturation, 80) * 1%) calc(var(--lightness, 55) * 1%) / var(--border-spot-opacity, 0.9)), transparent 100%
      );
      filter: brightness(2);
    }

    [data-glow-card]::after {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
        calc(var(--x, 50%) * 1px)
        calc(var(--y, 50%) * 1px),
        hsl(0 100% 100% / var(--border-light-opacity, 0.6)), transparent 100%
      );
    }

    [data-glow-card] [data-glow-inner] {
      position: absolute;
      inset: 0;
      border-radius: calc(var(--radius) * 1px);
      pointer-events: none;
    }
  `;

  const sizeClass = customSize ? '' : sizeMap[size];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: beforeAfterStyles }} />
      <div
        ref={cardRef}
        data-glow-card
        style={getInlineStyles()}
        className={`
          ${sizeClass}
          rounded-2xl
          relative
          shadow-[0_1rem_2rem_-1rem_black]
          p-4
          ${className}
        `}
      >
        <div ref={innerRef} data-glow-inner />
        {children}
      </div>
    </>
  );
};

export { GlowCard };
