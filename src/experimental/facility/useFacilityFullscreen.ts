import { useCallback, useEffect, useRef, useState } from 'react';

export function useFacilityFullscreen() {
  const workspace = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [native, setNative] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fullscreen = native || expanded;
  useEffect(() => {
    const element = workspace.current;
    const update = () => setNative(document.fullscreenElement === element);
    document.addEventListener('fullscreenchange', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => {});
    };
  }, []);
  const leave = useCallback(() => {
    setExpanded(false);
    if (document.fullscreenElement === workspace.current) void document.exitFullscreen().catch(() => {});
  }, []);
  const toggle = useCallback(async () => {
    if (fullscreen) { leave(); return; }
    const element = workspace.current;
    if (!element) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element.requestFullscreen) {
      try { await element.requestFullscreen(); } catch { setExpanded(true); }
    } else setExpanded(true);
  }, [fullscreen, leave]);
  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); leave(); return; }
      if (event.key !== 'Tab') return;
      const items = [...(workspace.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]') ?? [])]
        .filter(element => element.offsetParent !== null && !element.hasAttribute('disabled'));
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) return;
      if (!workspace.current?.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); first.focus();
      } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown, true);
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, [fullscreen, leave]);
  return { workspace, fullscreen, toggle, leave };
}
