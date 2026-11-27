"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils/format";

const PHONE = "(max-width: 639px)";

/** True on phone-width screens. Server render assumes desktop; dialogs only open after interaction anyway. */
export function useIsPhone() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(PHONE);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

/**
 * Modal: a Base UI dialog on larger screens, a Vaul bottom sheet (drag to
 * dismiss) on phones. Both trap focus, close on Escape and outside tap.
 * Motion follows emilkowalski/skills: modal 250ms ease-out from scale 0.96,
 * exit faster (200ms); sheet uses Vaul's drawer curve.
 */
export function Dialog(props: DialogProps) {
  return useIsPhone() ? <Sheet {...props} /> : <Modal {...props} />;
}

function Header({ title, description, Title, Description, close }: { title: ReactNode; description?: ReactNode; Title: typeof BaseDialog.Title | typeof Drawer.Title; Description: typeof BaseDialog.Description | typeof Drawer.Description; close?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-5 sm:px-6">
      <div className="min-w-0">
        <Title className="font-display text-lg font-semibold">{title}</Title>
        {description ? <Description className="mt-1 text-sm text-fg-3">{description}</Description> : null}
      </div>
      {close}
    </div>
  );
}

function Modal({ open, onClose, title, description, children, footer, size = "md" }: DialogProps) {
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <BaseDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm transition-opacity duration-[250ms] ease-out data-[ending-style]:duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-line bg-ink-850 text-fg shadow-2xl outline-none",
            "transition-[opacity,scale] duration-[250ms] ease-out data-[ending-style]:duration-200 data-[ending-style]:scale-96 data-[ending-style]:opacity-0 data-[starting-style]:scale-96 data-[starting-style]:opacity-0",
            width,
          )}
        >
          <Header
            title={title}
            description={description}
            Title={BaseDialog.Title}
            Description={BaseDialog.Description}
            close={
              <BaseDialog.Close className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-fg-3 transition-colors hover:bg-white/[0.06] hover:text-fg" aria-label="Close dialog">
                <X className="size-[18px]" />
              </BaseDialog.Close>
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div> : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

function Sheet({ open, onClose, title, description, children, footer }: DialogProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/65" />
        <Drawer.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[28px] border border-b-0 border-line bg-ink-850 text-fg outline-none"
        >
          <Drawer.Handle className="mt-3 !h-1.5 !w-10 !bg-line-strong" />
          <Header title={title} description={description} Title={Drawer.Title} Description={Drawer.Description} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">{footer}</div> : <div className="pb-[env(safe-area-inset-bottom)]" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
