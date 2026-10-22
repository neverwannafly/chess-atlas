import * as React from "react";
import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;

export function PopoverContent({ className, align = "start", sideOffset = 6, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface text-ink shadow-lg shadow-black/10 outline-none", className)}
        {...props}
      />
    </P.Portal>
  );
}
