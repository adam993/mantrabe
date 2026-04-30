export type EntryKind = 'mantra' | 'reminder';

export interface Mantra {
  id: string;
  /** 'mantra' = a contemplative phrase to return to; 'reminder' = a practical
   *  nudge (drink water, stretch). Stored on the same table because their
   *  scheduling/storage shape is identical — only the framing + styling differs. */
  kind: EntryKind;
  text: string;
  frequencyMinutes: number;
  activeHours: { start: number; end: number };
  activeDays: boolean[];
  /** When non-empty, scheduling fires at exactly these hours (0–23) on each
   *  active day, and `frequencyMinutes` / `activeHours` are ignored. Up to 5
   *  entries — the "multiple times during a day" mode in the editor. */
  specificTimes?: number[];
  enabled: boolean;
  soundId: string;
  createdAt: number;
  updatedAt: number;
  /** Set when the row has been written to Supabase under the current user. */
  remoteSyncedAt?: number;
}
