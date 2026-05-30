import React from 'react';
import { cn } from "@/lib/utils";

// A single social link. Prefer `icon` (an inline React node, e.g. an <svg>);
// `svgUrl` is kept as a fallback for image-based icons.
export interface SocialItem {
  href: string;
  ariaLabel: string;
  tooltip: string;
  color: string; // brand color used for the hover fill + tooltip background
  icon?: React.ReactNode;
  svgUrl?: string;
}

export interface SocialTooltipProps extends React.HTMLAttributes<HTMLUListElement> {
  items: SocialItem[];
}

const SocialTooltip = React.forwardRef<HTMLUListElement, SocialTooltipProps>(
  ({ className, items, ...props }, ref) => {
    const baseIconStyles =
      "relative flex items-center justify-center w-9 h-9 rounded-full bg-zinc-800 ring-1 ring-white/10 overflow-hidden transition-all duration-300 ease-in-out group-hover:shadow-lg";
    const baseSvgStyles =
      "relative z-10 flex items-center justify-center w-[18px] h-[18px] text-zinc-300 transition-colors duration-300 ease-in-out group-hover:text-white";
    const baseFilledStyles =
      "absolute bottom-0 left-0 w-full h-0 transition-all duration-300 ease-in-out group-hover:h-full";
    const baseTooltipStyles =
      "absolute bottom-[-34px] left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white whitespace-nowrap rounded-md opacity-0 invisible transition-all duration-300 ease-in-out group-hover:opacity-100 group-hover:visible group-hover:bottom-[-40px] z-20";

    return (
      <ul
        ref={ref}
        className={cn("flex items-center justify-center gap-3", className)}
        {...props}
      >
        {items.map((item, index) => (
          <li key={index} className="relative group">
            <a
              href={item.href}
              aria-label={item.ariaLabel}
              className={cn(baseIconStyles)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div
                className={cn(baseFilledStyles)}
                style={{ backgroundColor: item.color }}
              />
              {item.icon ? (
                <span className={cn(baseSvgStyles)}>{item.icon}</span>
              ) : item.svgUrl ? (
                <img
                  src={item.svgUrl}
                  alt={item.ariaLabel}
                  className={cn(baseSvgStyles)}
                />
              ) : null}
            </a>
            <div
              className={cn(baseTooltipStyles)}
              style={{ backgroundColor: item.color }}
            >
              {item.tooltip}
            </div>
          </li>
        ))}
      </ul>
    );
  }
);

SocialTooltip.displayName = "SocialTooltip";

export { SocialTooltip };
