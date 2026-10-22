import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = D.Root;
export const SheetTitle = D.Title;
export const SheetDescription = D.Description;
export const SheetClose = D.Close;

/** Right-side drawer on ≥768px, bottom sheet on mobile. */
export function SheetContent({ className, children, width = "md:w-[560px]", ...props }: React.ComponentProps<typeof D.Content> & { width?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="anim-overlay fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "anim-drawer fixed z-[61] flex flex-col bg-surface text-fg shadow-e3 outline-none",
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-lg border-t border-border",
          "md:inset-y-2 md:right-2 md:left-auto md:bottom-2 md:max-h-none md:rounded-lg md:border",
          width,
          className
        )}
        {...props}
      >
        <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong md:hidden" aria-hidden />
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function SheetCloseButton({ className }: { className?: string }) {
  return (
    <D.Close className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg", className)} aria-label="Close">
      <X className="h-4 w-4" aria-hidden />
    </D.Close>
  );
}
