import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Bonsai } from './bonsai';
import { BonsaiList } from './bonsai-list';
import { MantraOverlay } from './mantra-overlay';
import { useSlotMap, type SlotBinding } from '@/hooks/use-slot-map';
import type { Mantra } from '@/types/mantra';

interface BonsaiPageProps {
  mantras: Mantra[];
  onBack: () => void;
  /** Empty-slot tap → open the editor pre-filled with this slot index. */
  onAddToSlot: (slotIndex: number) => void;
}

export function BonsaiPage({ mantras, onBack, onAddToSlot }: BonsaiPageProps) {
  const slots = useSlotMap(mantras);
  const [activeSlot, setActiveSlot] = React.useState(-1);
  const [openMantra, setOpenMantra] = React.useState<Mantra | null>(null);

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

      <Bonsai
        slots={slots}
        activeSlot={activeSlot}
        onActivateSlot={handleLeafActivate}
      />

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
