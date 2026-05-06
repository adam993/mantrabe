import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Bonsai } from "./bonsai";
import { BonsaiList } from "./bonsai-list";
import { MantraOverlay } from "./mantra-overlay";
import {
  LANTERN_HIT_HALF_W,
  LANTERN_HIT_HEIGHT,
  LANTERN_HIT_TOP,
  LanternBody,
  slotDndId,
} from "./leaf-slot";
import { BONSAI_VIEWBOX } from "./slots";
import { useSlotMap, type SlotBinding } from "@/hooks/use-slot-map";
import type { Mantra } from "@/types/mantra";

interface BonsaiPageProps {
  mantras: Mantra[];
  onBack: () => void;
  /** Empty-slot tap → open the editor pre-filled with this slot index. */
  onAddToSlot: (slotIndex: number) => void;
  /** Persist a batch of {mantra, newSlotIndex} updates from a swap or
   *  move. The page calls this with one update for a move-to-empty and
   *  two updates for a swap. */
  onMoveMantras: (
    updates: Array<{ id: string; slotIndex: number }>,
  ) => Promise<void>;
}

function dndIdToSlotIndex(id: unknown): number {
  if (typeof id !== "string") return -1;
  const match = /^bonsai-slot-(\d+)$/.exec(id);
  return match ? Number(match[1]) : -1;
}

// The DragOverlay's viewBox is locked to the LeafSlot's draggable
// handle bounding box (focus ring + lantern body + hit target), so the
// dragged lantern lines up pixel-for-pixel with where the user grabbed
// it. dnd-kit positions the overlay at the source's
// getBoundingClientRect; if the overlay's internal lantern is offset
// from the SVG top-left differently than in the source, the lantern
// teleports on drag start. Using the same rect on both sides removes
// the offset entirely. The overlay SVG sets `overflow: visible` so the
// CSS glow drop-shadow can extend past these tight bounds.
const OVERLAY_VB_HALF_W = LANTERN_HIT_HALF_W;
const OVERLAY_VB_TOP = LANTERN_HIT_TOP;
const OVERLAY_VB_HEIGHT = LANTERN_HIT_HEIGHT;
const OVERLAY_VB_WIDTH = OVERLAY_VB_HALF_W * 2;

export function BonsaiPage({
  mantras,
  onBack,
  onAddToSlot,
  onMoveMantras,
}: BonsaiPageProps) {
  const slots = useSlotMap(mantras);
  const [activeSlot, setActiveSlot] = React.useState(-1);
  const [openMantra, setOpenMantra] = React.useState<Mantra | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = React.useState(0);

  // Track the rendered stage width so the DragOverlay can size its
  // standalone lantern SVG to match the on-screen lantern size. The
  // stage is `max-w-[440px]` and otherwise viewport-fluid; ResizeObserver
  // catches both the initial measurement and any window resize.
  React.useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    setStageWidth(node.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setStageWidth(entry.contentRect.width);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // Distance-activation only — a tap at rest never starts a drag, so
  // tap-to-open and drag-to-move never collide. ~6px matches the spec.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  }, []);

  const handleDragCancel = React.useCallback(() => {
    setDraggingId(null);
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null);
      const { active, over } = event;
      if (!over) return;
      const srcIdx = dndIdToSlotIndex(active.id);
      const dstIdx = dndIdToSlotIndex(over.id);
      if (srcIdx === -1 || dstIdx === -1 || srcIdx === dstIdx) return;
      const srcMantra = slots[srcIdx]?.mantra;
      const dstMantra = slots[dstIdx]?.mantra;
      if (!srcMantra) return;
      const updates: Array<{ id: string; slotIndex: number }> = [
        { id: srcMantra.id, slotIndex: dstIdx },
      ];
      if (dstMantra) updates.push({ id: dstMantra.id, slotIndex: srcIdx });
      void onMoveMantras(updates);
    },
    [slots, onMoveMantras],
  );

  const draggingIdx = draggingId ? dndIdToSlotIndex(draggingId) : -1;
  const draggingMantra =
    draggingIdx >= 0 ? (slots[draggingIdx]?.mantra ?? null) : null;
  const stageScale = stageWidth > 0 ? stageWidth / BONSAI_VIEWBOX.width : 0;
  const overlayWidthPx = OVERLAY_VB_WIDTH * stageScale;
  const overlayHeightPx = OVERLAY_VB_HEIGHT * stageScale;

  const openSlot = React.useCallback(
    (slot: SlotBinding) => {
      setActiveSlot(slot.index);
      if (slot.mantra) {
        setOpenMantra(slot.mantra);
      } else {
        onAddToSlot(slot.index);
      }
    },
    [onAddToSlot],
  );

  const handleLeafActivate = React.useCallback(
    (index: number, mantra: Mantra | null) => {
      openSlot({ index, mantra });
    },
    [openSlot],
  );

  return (
    <main
      data-id="bonsai-screen"
      className="screen-fade mx-auto flex w-full max-w-[var(--topbar-width)] flex-1 flex-col gap-4 p-5"
    >
      <header className="mx-auto flex w-full max-w-[var(--content-width)] flex-col gap-2">
        <Button
          data-id="bonsai-back"
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="Back to mantra list"
          className="inline-flex w-fit items-center gap-2 self-start"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-serif-zen tracking-wide">Back</span>
        </Button>
        <h1 className="text-center font-serif-zen text-[1.15rem] font-medium text-foreground">
          Sit with your bonsai
        </h1>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {/* Wrapper carries the same width cap as the bonsai stage so its
         *  ResizeObserver reports the actual rendered stage width. The
         *  inner Bonsai still has its own w-full + max-w-[440px], which
         *  is harmless when the parent is already constrained. */}
        <div ref={stageRef} className="mx-auto w-full max-w-[440px]">
          <Bonsai
            slots={slots}
            activeSlot={activeSlot}
            onActivateSlot={handleLeafActivate}
            isDragActive={draggingId !== null}
          />
        </div>
        {/* DragOverlay must be portalled to <body>: dnd-kit positions the
         *  overlay wrapper with `position: fixed; top: rect.top; left:
         *  rect.left`, where rect is the source's viewport-relative
         *  `getBoundingClientRect()`. If any ancestor of the overlay has
         *  a non-`none` `transform` (or `filter`, `perspective`, or
         *  `will-change`), CSS makes that ancestor the containing block
         *  for fixed descendants — and the overlay interprets those
         *  viewport coords relative to the ancestor instead, teleporting
         *  the lantern by the ancestor's offset. `<main>` here carries
         *  `.screen-fade`, whose animation leaves a `transform:
         *  translateY(0)` on the element via `animation-fill-mode:
         *  both`. Portalling the overlay out to <body> escapes that
         *  containing block while still letting the JSX consume the
         *  surrounding DndContext (React context flows through portals). */}
        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay dropAnimation={null}>
              {draggingMantra && stageScale > 0 ? (
                <svg
                  data-id="bonsai-drag-overlay"
                  viewBox={`${-OVERLAY_VB_HALF_W} ${OVERLAY_VB_TOP} ${OVERLAY_VB_WIDTH} ${OVERLAY_VB_HEIGHT}`}
                  width={overlayWidthPx}
                  height={overlayHeightPx}
                  xmlns="http://www.w3.org/2000/svg"
                  // `display: block` keeps the SVG pinned to its
                  // wrapper's top-left. As an inline replaced element,
                  // an SVG sits on the parent's text baseline and would
                  // lift ~line-height above the dnd-kit wrapper top,
                  // re-introducing a vertical teleport.
                  style={{
                    display: "block",
                    pointerEvents: "none",
                    overflow: "visible",
                  }}
                >
                  <LanternBody
                    mantra={draggingMantra}
                    active={false}
                    cx={0}
                    cy={0}
                    idKey="overlay"
                  />
                </svg>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      <BonsaiList
        slots={slots}
        activeSlot={activeSlot}
        onHighlight={setActiveSlot}
        onOpen={openSlot}
      />

      <MantraOverlay mantra={openMantra} onClose={() => setOpenMantra(null)} />
    </main>
  );
}
