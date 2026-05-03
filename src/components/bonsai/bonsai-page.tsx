import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Bonsai } from './bonsai';
import { BonsaiList } from './bonsai-list';
import { MantraOverlay } from './mantra-overlay';
import { slotDndId } from './leaf-slot';
import { useSlotMap, type SlotBinding } from '@/hooks/use-slot-map';
import type { Mantra } from '@/types/mantra';

interface BonsaiPageProps {
  mantras: Mantra[];
  onBack: () => void;
  /** Empty-slot tap → open the editor pre-filled with this slot index. */
  onAddToSlot: (slotIndex: number) => void;
  /** Persist a batch of {mantra, newSlotIndex} updates from a swap or
   *  move. The page calls this with one update for a move-to-empty and
   *  two updates for a swap. */
  onMoveMantras: (updates: Array<{ id: string; slotIndex: number }>) => Promise<void>;
}

function dndIdToSlotIndex(id: unknown): number {
  if (typeof id !== 'string') return -1;
  const match = /^bonsai-slot-(\d+)$/.exec(id);
  return match ? Number(match[1]) : -1;
}

export function BonsaiPage({
  mantras,
  onBack,
  onAddToSlot,
  onMoveMantras,
}: BonsaiPageProps) {
  const slots = useSlotMap(mantras);
  const [activeSlot, setActiveSlot] = React.useState(-1);
  const [openMantra, setOpenMantra] = React.useState<Mantra | null>(null);

  // Distance-activation only — a tap at rest never starts a drag, so
  // tap-to-open and drag-to-move never collide. ~6px matches the spec.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
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
      <header className="mx-auto flex w-full max-w-[var(--content-width)] items-center justify-between">
        <Button
          data-id="bonsai-back"
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="Back to mantra list"
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-serif-zen tracking-wide">Back</span>
        </Button>
        <h1 className="font-serif-zen text-[1.15rem] font-medium tracking-wide text-foreground">
          Sit with your bonsai
        </h1>
        <span className="w-[68px]" aria-hidden="true" /> {/* spacer to balance back button */}
      </header>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Bonsai
          slots={slots}
          activeSlot={activeSlot}
          onActivateSlot={handleLeafActivate}
        />
      </DndContext>

      <BonsaiList
        slots={slots}
        activeSlot={activeSlot}
        onHighlight={setActiveSlot}
        onOpen={openSlot}
      />

      <MantraOverlay
        mantra={openMantra}
        onClose={() => setOpenMantra(null)}
      />
    </main>
  );
}
