import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  children: ReactNode;
  align?: "start" | "end";
  width?: number;
}

/**
 * Portal-rendered menu, fixed-positioned from the trigger's bounding rect at open time.
 * Avoids clipping/overlap bugs that absolute-positioned menus get inside scrollable
 * table cells (position is computed against the viewport, not a table-row ancestor).
 */
export function DropdownMenu({ open, onClose, anchorEl, children, align = "end", width = 224 }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;

    function reposition() {
      const rect = anchorEl!.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      const menuH = menuRef.current?.offsetHeight ?? 240;
      const spaceBelow = viewportH - rect.bottom;
      const openUpward = spaceBelow < menuH + 12 && rect.top > menuH + 12;

      let left = align === "end" ? rect.right - width : rect.left;
      left = Math.min(Math.max(left, 8), viewportW - width - 8);

      setStyle({
        position: "fixed",
        top: openUpward ? undefined : rect.bottom + 6,
        bottom: openUpward ? viewportH - rect.top + 6 : undefined,
        left,
        width,
        visibility: "visible",
      });
    }

    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open, anchorEl, align, width]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    }
    function handleScroll(e: Event) {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorEl]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="card p-1.5 z-[70] shadow-popover animate-scale-in max-h-80 overflow-y-auto"
    >
      {children}
    </div>,
    document.body
  );
}
