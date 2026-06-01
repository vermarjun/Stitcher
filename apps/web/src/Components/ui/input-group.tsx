import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal input-group primitive (shadcn @coss/p-input-group-20 API), themed for
 * the app's dark surface. Exposes InputGroup / InputGroupAddon / InputGroupInput.
 */

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex h-9 w-full items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3.5 text-sm shadow-sm transition-colors",
        "focus-within:border-zinc-700 focus-within:bg-zinc-900",
        className
      )}
      {...props}
    />
  );
}

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & {
  align?: "inline-start" | "inline-end";
}) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex items-center justify-center text-zinc-500 [&>svg]:size-4 [&>svg]:shrink-0",
        align === "inline-end" && "order-last",
        className
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input-group-control"
      className={cn(
        "h-full flex-1 border-0 bg-transparent py-1.5 text-white outline-none placeholder:text-zinc-600 [&::-webkit-search-cancel-button]:appearance-none",
        className
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupInput };
