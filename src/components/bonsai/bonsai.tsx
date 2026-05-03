import * as React from 'react';
import type { Mantra } from '@/types/mantra';
import { LeafSlot } from './leaf-slot';
import type { SlotBinding } from '@/hooks/use-slot-map';

interface BonsaiProps {
  slots: SlotBinding[];
  /** Slot index whose leaf should glow. -1 means none. */
  activeSlot: number;
  onActivateSlot: (index: number, mantra: Mantra | null) => void;
}

/**
 * The bonsai itself — a hand-authored SVG.
 *
 * Trunk and branches are tapered by stacking a heavy stroke (body) and a
 * lighter, narrower stroke (highlight) on the same path. Foliage clouds
 * are three-layer ellipses (under-shade, base, top-light) for a painted
 * feel. The whole tree is intentionally still — only the active-leaf
 * glow animates (handled in CSS).
 */
export function Bonsai({ slots, activeSlot, onActivateSlot }: BonsaiProps) {
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
    <svg
      data-id="bonsai-svg"
      viewBox="0 0 480 380"
      role="img"
      aria-label={`Your serenity bonsai with ${counts.mantras} mantra${counts.mantras === 1 ? '' : 's'} and ${counts.reminders} reminder${counts.reminders === 1 ? '' : 's'}`}
      className="bonsai-svg block w-full max-w-[560px] mx-auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="bonsaiHalo" cx="50%" cy="62%" r="60%">
          <stop offset="0%" stopColor="var(--bg-elevated)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--bg-elevated)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bonsaiGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.7" />
          <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bonsaiPotShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a7d68" />
          <stop offset="100%" stopColor="#5e5446" />
        </linearGradient>
      </defs>

      {/* Soft warm halo under the pot. */}
      <ellipse cx={240} cy={300} rx={220} ry={40} fill="url(#bonsaiHalo)" />

      {/* Pot. */}
      <path
        d="M168 318 Q168 312 174 312 L306 312 Q312 312 312 318 L300 360 Q300 366 294 366 L186 366 Q180 366 180 360 Z"
        fill="url(#bonsaiPotShade)"
      />
      <line x1={168} y1={318} x2={312} y2={318} stroke="var(--text)" strokeOpacity={0.45} strokeWidth={1.2} />
      <line x1={172} y1={324} x2={308} y2={324} stroke="var(--text)" strokeOpacity={0.18} strokeWidth={0.8} />

      {/* Root flares peeking above the rim. */}
      <path d="M232 314 C 232 308, 226 304, 220 302" stroke="var(--text)" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.75} />
      <path d="M250 314 C 252 308, 258 305, 262 304" stroke="var(--text)" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />

      {/* Trunk: heavy body + lighter highlight on the same curve. */}
      <path
        d="M240 312 C 234 280, 220 250, 208 220 C 196 188, 196 162, 214 138 C 230 116, 250 100, 258 76"
        fill="none"
        stroke="var(--text)"
        strokeWidth={9}
        strokeLinecap="round"
        opacity={0.95}
      />
      <path
        d="M240 312 C 234 280, 220 250, 208 220 C 196 188, 196 162, 214 138 C 230 116, 250 100, 258 76"
        fill="none"
        stroke="var(--text)"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.55}
      />

      {/* Right mid branch. */}
      <path d="M208 220 C 240 206, 280 198, 318 196" fill="none" stroke="var(--text)" strokeWidth={6} strokeLinecap="round" opacity={0.93} />
      <path d="M208 220 C 240 206, 280 198, 318 196" fill="none" stroke="var(--text)" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      {/* Left mid branch. */}
      <path d="M204 174 C 178 168, 154 168, 134 172" fill="none" stroke="var(--text)" strokeWidth={5} strokeLinecap="round" opacity={0.93} />
      {/* Crown branches. */}
      <path d="M258 76 C 280 70, 304 72, 322 84" fill="none" stroke="var(--text)" strokeWidth={4.5} strokeLinecap="round" opacity={0.93} />
      <path d="M258 76 C 240 68, 218 68, 200 76" fill="none" stroke="var(--text)" strokeWidth={4.5} strokeLinecap="round" opacity={0.93} />
      {/* Twigs. */}
      <path d="M134 172 C 124 174, 116 178, 110 184" fill="none" stroke="var(--text)" strokeWidth={2} strokeLinecap="round" opacity={0.75} />
      <path d="M318 196 C 326 196, 332 198, 338 202" fill="none" stroke="var(--text)" strokeWidth={2} strokeLinecap="round" opacity={0.75} />
      <path d="M200 76 C 188 72, 178 72, 170 76" fill="none" stroke="var(--text)" strokeWidth={2} strokeLinecap="round" opacity={0.75} />

      {/* Foliage clouds. Three layers each: under-shade, base, top-light highlight. */}
      {/* Left cloud. */}
      <ellipse cx={124} cy={176} rx={32} ry={18} fill="#5a7a5e" opacity={0.85} />
      <ellipse cx={124} cy={172} rx={30} ry={16} fill="var(--accent)" opacity={0.85} />
      <ellipse cx={118} cy={168} rx={14} ry={8} fill="#7ea484" opacity={0.7} />
      {/* Right cloud. */}
      <ellipse cx={320} cy={200} rx={38} ry={20} fill="#5a7a5e" opacity={0.85} />
      <ellipse cx={320} cy={196} rx={36} ry={18} fill="var(--accent)" opacity={0.85} />
      <ellipse cx={316} cy={190} rx={16} ry={9} fill="#7ea484" opacity={0.7} />
      {/* Crown cloud. */}
      <ellipse cx={262} cy={76} rx={48} ry={24} fill="#5a7a5e" opacity={0.88} />
      <ellipse cx={262} cy={72} rx={46} ry={22} fill="var(--accent)" opacity={0.88} />
      <ellipse cx={258} cy={66} rx={22} ry={11} fill="#7ea484" opacity={0.7} />

      {/* Leaves & berries — interactive. Rendered last so they sit above foliage. */}
      {slots.map((slot) => (
        <LeafSlot
          key={slot.index}
          index={slot.index}
          mantra={slot.mantra}
          active={slot.index === activeSlot}
          onActivate={(idx) => onActivateSlot(idx, slot.mantra)}
        />
      ))}
    </svg>
  );
}
