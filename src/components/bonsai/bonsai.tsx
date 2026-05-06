import * as React from 'react';
import bonsaiSvgRaw from '../../../assets/bonsai.svg?raw';
import type { Mantra } from '@/types/mantra';
import { LeafSlot } from './leaf-slot';
import { BONSAI_VIEWBOX } from './slots';
import type { SlotBinding } from '@/hooks/use-slot-map';

interface BonsaiProps {
  slots: SlotBinding[];
  /** Slot index whose star should glow. -1 means none. */
  activeSlot: number;
  onActivateSlot: (index: number, mantra: Mantra | null) => void;
  /** True while any lantern is mid-drag. Forwarded to LeafSlot so each
   *  slot can show its drop-target halo for the duration of the drag. */
  isDragActive: boolean;
}

/**
 * The bonsai page renders two stacked layers in a positioned wrapper:
 *
 *  1. The user-supplied bonsai illustration from /assets/bonsai.svg.
 *     We import it as raw text (via Vite's `?raw` suffix), pre-sized to
 *     fill its container width with `preserveAspectRatio` honored, and
 *     inject it via dangerouslySetInnerHTML so its `currentColor` fills
 *     inherit our CSS color (`var(--text)`) for both light and dark
 *     mode. The SVG itself was edited in place to swap its two original
 *     fills (#000000 + #0B0B09) to currentColor.
 *
 *  2. A transparent overlay SVG with the same viewBox, holding 15
 *     interactive star slots positioned to look like they hang from
 *     branches and foliage in the illustration below.
 *
 * The illustration is decorative — all interactivity (click, drag,
 * keyboard, screen-reader buttons) lives in the overlay layer.
 */
export function Bonsai({
  slots,
  activeSlot,
  onActivateSlot,
  isDragActive,
}: BonsaiProps) {
  const counts = React.useMemo(() => {
    let mantras = 0;
    let reminders = 0;
    for (const s of slots) {
      if (s.mantra?.kind === 'mantra') mantras += 1;
      else if (s.mantra?.kind === 'reminder') reminders += 1;
    }
    return { mantras, reminders };
  }, [slots]);

  return (
    <div
      data-id="bonsai-stage"
      className="bonsai-stage relative mx-auto w-full max-w-[440px]"
      style={{ color: 'var(--text)' }}
      role="img"
      aria-label={`Your serenity bonsai with ${counts.mantras} mantra${counts.mantras === 1 ? '' : 's'} and ${counts.reminders} reminder${counts.reminders === 1 ? '' : 's'}`}
    >
      {/* Layer 1 — illustration. */}
      <div
        data-id="bonsai-illustration"
        className="bonsai-illustration"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: bonsaiSvgRaw }}
      />

      {/* Layer 2 — interactive star overlay, viewBox-aligned with the illustration. */}
      <svg
        data-id="bonsai-overlay"
        viewBox={`0 0 ${BONSAI_VIEWBOX.width} ${BONSAI_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="bonsai-overlay absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="bonsaiGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.7" />
            <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {slots.map((slot) => (
          <LeafSlot
            key={slot.index}
            index={slot.index}
            mantra={slot.mantra}
            active={slot.index === activeSlot}
            onActivate={(idx) => onActivateSlot(idx, slot.mantra)}
            isDragActive={isDragActive}
          />
        ))}
      </svg>
    </div>
  );
}
