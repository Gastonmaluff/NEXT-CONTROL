import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  error?: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
};

const widths = { md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" };
let bodyScrollLocks = 0;
let previousBodyOverflow = "";
let previousPageFocus: HTMLElement | null = null;

type TabKeyEvent = {
  key: string;
  shiftKey: boolean;
  defaultPrevented: boolean;
  preventDefault: () => void;
};

function trapDialogTab(event: TabKeyEvent, dialog: HTMLDialogElement, heading: HTMLHeadingElement | null) {
  if (event.key !== "Tab" || event.defaultPrevented) return;
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
    'button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable="true"]'
  )).filter(element => {
    const style = window.getComputedStyle(element);
    return element.tabIndex >= 0
      && !element.matches(":disabled")
      && element.getAttribute("aria-disabled") !== "true"
      && !element.closest('[inert], [aria-hidden="true"]')
      && element.getClientRects().length > 0
      && style.visibility !== "hidden"
      && style.visibility !== "collapse";
  });

  event.preventDefault();
  if (!focusable.length) {
    heading?.focus({ preventScroll: true });
    return;
  }

  const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
  const nextIndex = event.shiftKey
    ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
    : currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
  focusable[nextIndex].focus();
}

export default function InstallationDialog({
  title,
  description,
  error,
  onClose,
  busy = false,
  children,
  footer,
  size = "lg"
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (previousFocus && previousFocus !== document.body && !previousFocus.closest("dialog")) {
      previousPageFocus = previousFocus;
    }
    if (bodyScrollLocks === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    bodyScrollLocks += 1;
    if (!dialog.open) dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      bodyScrollLocks = Math.max(0, bodyScrollLocks - 1);
      if (bodyScrollLocks === 0) document.body.style.overflow = previousBodyOverflow;
      requestAnimationFrame(() => {
        // A sibling dialog may open during the same update (results / goals).
        if (document.querySelector("dialog[open]")) return;
        const target = previousFocus && previousFocus !== document.body && previousFocus.isConnected
          ? previousFocus : previousPageFocus;
        if (target?.isConnected) target.focus({ preventScroll: true });
        previousPageFocus = null;
      });
    };
  }, []);

  useEffect(() => {
    scrollRegionRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);

  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() => {
      const alert = dialogRef.current?.querySelector<HTMLElement>('[role="alert"]');
      if (!alert) return;
      alert.tabIndex = -1;
      alert.scrollIntoView({ block: "nearest" });
      alert.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [error]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function trapOutsideTab(event: KeyboardEvent) {
      if (!dialog?.open || dialog.contains(document.activeElement)) return;
      const openDialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      trapDialogTab(event, dialog, headingRef.current);
    }
    document.addEventListener("keydown", trapOutsideTab, true);
    return () => document.removeEventListener("keydown", trapOutsideTab, true);
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={busy}
      onKeyDown={(event) => trapDialogTab(event, event.currentTarget, headingRef.current)}
      className={["m-auto w-[calc(100%-1.5rem)] overflow-hidden rounded-3xl border-0 bg-white p-0 text-next-text shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm sm:w-[calc(100%-3rem)]", widths[size]].join(" ")}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (backdropPress.current && event.target === event.currentTarget && !busy) onClose();
        backdropPress.current = false;
      }}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] min-w-0 flex-col sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <h2 ref={headingRef} id={titleId} tabIndex={-1} className="break-words text-xl font-black tracking-tight text-next-text outline-none sm:text-2xl">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1.5 max-w-2xl text-sm leading-6 text-next-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Cerrar ventana"
            disabled={busy}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-next-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-next-blue disabled:cursor-wait disabled:opacity-40"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div ref={scrollRegionRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">{children}</div>
        {footer ? <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-7">{footer}</footer> : null}
      </div>
    </dialog>,
    document.body
  );
}
