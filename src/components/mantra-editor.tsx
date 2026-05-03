import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ONCE_A_DAY } from "@/lib/scheduler";
import { SOUNDS, DEFAULT_SOUND_ID } from "@/lib/sounds";
import { playBellChime } from "@/lib/bell-chime";
import { fireTestNotification } from "@/lib/notifications";
import { makeMantra } from "@/lib/storage";
import { KindToggle } from "@/components/kind-toggle";
import { StepIndicator } from "@/components/step-indicator";
import type { EntryKind, Mantra } from "@/types/mantra";

interface Props {
  initial: Mantra | null;
  /** When set on a "new mantra" flow, the saved mantra claims this bonsai
   *  leaf slot (0–14). Used by the "tap an empty leaf" flow on the bonsai
   *  page. Ignored when editing an existing mantra. */
  targetSlot?: number;
  onCancel: () => void;
  onSave: (mantra: Mantra) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onPermissionGate: () => Promise<boolean>;
}

type Step = 1 | 2 | 3;
const TOTAL_STEPS = 3;

// "Choose how often" presets — interval-based scheduling. Once-a-day moved
// out of this list and into the "Choose exact times" branch in Step 2.
const FREQ_PRESETS: number[] = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_SPECIFIC_TIMES = 5;

const PLACEHOLDER: Record<EntryKind, string> = {
  mantra:
    "e.g. I must not fear. Fear is the mind-killer. Fear is the little-death that brings total obliteration. I will face my fear. I will permit it to pass over me and through me. And when it has gone past, I will turn the inner eye to see its path. Where the fear has gone there will be nothing. Only I will remain.",
  reminder: "e.g. Drink a glass of water.",
};

const STEP_TITLES: Record<Step, string> = {
  1: "What to remember",
  2: "How often & how it sounds",
  3: "When to ring",
};

function freqLabel(p: number): string {
  if (p >= ONCE_A_DAY) return "Once a day";
  if (p < 60) return `Every ${p} minutes`;
  if (p === 60) return "Every hour";
  return `Every ${p / 60} hours`;
}

function hasSpecificTimes(m: Mantra): boolean {
  return Array.isArray(m.specificTimes) && m.specificTimes.length > 0;
}

// Pick a default hour for a freshly-activated slot in multiple-times mode —
// first hour from 9..23 not already chosen, then 0..8 as fallback. Keeps
// new slots from colliding with existing ones.
function nextDefaultHour(taken: number[]): number {
  const set = new Set(taken);
  for (let h = 9; h <= 23; h++) if (!set.has(h)) return h;
  for (let h = 0; h <= 8; h++) if (!set.has(h)) return h;
  return 9;
}

export function MantraEditor({
  initial,
  targetSlot,
  onCancel,
  onSave,
  onDelete,
  onPermissionGate,
}: Props) {
  const [draft, setDraft] = React.useState<Mantra>(
    () => initial ?? makeMantra({ slotIndex: targetSlot }),
  );
  const [step, setStep] = React.useState<Step>(1);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const canAdvance = step !== 1 || draft.text.trim().length > 0;
  const isLast = step === TOTAL_STEPS;
  const isReminder = draft.kind === "reminder";

  const patch = (p: Partial<Mantra>) => setDraft((d) => ({ ...d, ...p }));

  const goNext = async () => {
    if (!canAdvance) return;
    if (isLast) {
      const next: Mantra = { ...draft, text: draft.text.trim() };
      await onSave(next);
      onPermissionGate().catch((err) =>
        console.error("permission gate failed:", err),
      );
      return;
    }
    setStep((s) => (s + 1) as Step);
  };

  const goBack = () => {
    if (step === 1) {
      onCancel();
    } else {
      setStep((s) => (s - 1) as Step);
    }
  };

  return (
    <main
      data-id="editor"
      data-kind={draft.kind}
      data-step={step}
      className="screen-fade mx-auto flex w-full max-w-[var(--content-width)] flex-1 flex-col gap-5 p-5"
    >
      <header data-id="editor-header" className="flex items-center gap-3 py-3">
        <Button
          data-id="editor-back"
          variant="ghost"
          size="sm"
          onClick={goBack}
        >
          {step === 1 ? "Cancel" : "← Back"}
        </Button>
        <div
          data-id="editor-title"
          className="flex flex-1 items-center justify-center font-serif-zen text-[1.25rem] font-medium tracking-wide"
        >
          {initial ? `Edit ${draft.kind}` : `New ${draft.kind}`}
        </div>
        <Button data-id="editor-next" onClick={goNext} disabled={!canAdvance}>
          {isLast ? "Save" : "Next"}
        </Button>
      </header>

      <StepIndicator current={step} total={TOTAL_STEPS} />

      <p
        data-id="editor-step-title"
        className="text-center font-serif-zen text-[0.95rem] italic text-muted-foreground"
      >
        {STEP_TITLES[step]}
      </p>

      {step === 1 && (
        <Step1 draft={draft} patch={patch} isReminder={isReminder} />
      )}
      {step === 2 && (
        <Step2
          draft={draft}
          patch={patch}
          onPermissionGate={onPermissionGate}
        />
      )}
      {step === 3 && <Step3 draft={draft} patch={patch} />}

      {/* Shared bottom navigation row, mirrors the topbar pair so the
          user can advance/retreat without reaching to the top. Larger
          size + drop shadow makes them stay readable when the grass
          strip overlays the screen edge. */}
      <div
        data-id="editor-step-nav"
        className="flex justify-between gap-3"
      >
        <Button
          data-id="editor-step-nav-back"
          variant="ghost"
          size="lg"
          className="min-w-28 shadow-md"
          onClick={goBack}
        >
          {step === 1 ? "Cancel" : "← Back"}
        </Button>
        <Button
          data-id="editor-step-nav-next"
          size="lg"
          className="min-w-28 shadow-lg shadow-primary/30"
          onClick={goNext}
          disabled={!canAdvance}
        >
          {isLast ? "Save" : "Next"}
        </Button>
      </div>

      {initial && step === TOTAL_STEPS && (
        <div data-id="editor-destructive" className="mt-3 flex flex-wrap gap-3">
          <Button
            data-id="editor-delete"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            Delete this {draft.kind}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent data-id="editor-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {draft.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stops scheduled reminders for this {draft.kind}. If you're signed
              in, it will be removed from your synced mantras as well.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-id="editor-delete-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-id="editor-delete-confirm"
              onClick={() => {
                if (initial) onDelete(initial.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

// --- Steps -------------------------------------------------------------------

function Step1({
  draft,
  patch,
  isReminder,
}: {
  draft: Mantra;
  patch: (p: Partial<Mantra>) => void;
  isReminder: boolean;
}) {
  return (
    <section data-id="editor-step-1" className="flex flex-col gap-5">
      <Field id="kind" label="Type">
        <KindToggle value={draft.kind} onChange={(kind) => patch({ kind })} />
      </Field>
      <Field id="mantra" label={isReminder ? "Reminder" : "Mantra"}>
        <Textarea
          data-id="field-mantra-textarea"
          rows={8}
          maxLength={500}
          autoFocus
          placeholder={PLACEHOLDER[draft.kind]}
          value={draft.text}
          onChange={(e) => patch({ text: e.target.value })}
        />
      </Field>
    </section>
  );
}

function Step2({
  draft,
  patch,
  onPermissionGate,
}: {
  draft: Mantra;
  patch: (p: Partial<Mantra>) => void;
  onPermissionGate: () => Promise<boolean>;
}) {
  // Three derived states from a Mantra:
  //   - multiple times:  specificTimes is non-empty
  //   - once a day:      frequencyMinutes >= ONCE_A_DAY (and no specificTimes)
  //   - how-often:       everything else
  const isMultiple = hasSpecificTimes(draft);
  const isOnceADay = !isMultiple && draft.frequencyMinutes >= ONCE_A_DAY;
  const isExact = isMultiple || isOnceADay;

  // Switching modes. Each handler resets the fields the new mode needs and
  // clears the ones the old mode owned, so the saved Mantra is always in a
  // single canonical state.
  const switchToHowOften = () => {
    const presetValid =
      FREQ_PRESETS.includes(draft.frequencyMinutes) &&
      draft.frequencyMinutes < ONCE_A_DAY;
    patch({
      frequencyMinutes: presetValid ? draft.frequencyMinutes : 60,
      specificTimes: undefined,
    });
  };
  const switchToOnceADay = () => {
    const startHour =
      draft.activeHours.start >= 0 && draft.activeHours.start <= 23
        ? draft.activeHours.start
        : 9;
    patch({
      frequencyMinutes: ONCE_A_DAY,
      activeHours: { start: startHour, end: Math.min(24, startHour + 1) },
      specificTimes: undefined,
    });
  };
  const switchToMultiple = () => {
    const seed =
      draft.specificTimes && draft.specificTimes.length > 0
        ? draft.specificTimes
        : [9];
    patch({ specificTimes: seed });
  };

  return (
    <section data-id="editor-step-2" className="flex flex-col gap-5">
      <Field id="frequency-mode" label="Frequency">
        <BinaryToggle
          dataId="frequency-mode-toggle"
          ariaLabel="Frequency mode"
          value={isExact ? "exact" : "how-often"}
          options={[
            { value: "how-often", label: "Choose how often" },
            { value: "exact", label: "Choose exact times" },
          ]}
          onChange={(v) => {
            if (v === "how-often") switchToHowOften();
            else if (!isExact) switchToOnceADay();
          }}
        />
      </Field>

      {isExact ? (
        <>
          <Field id="exact-mode" label="Exact times">
            <BinaryToggle
              dataId="exact-mode-toggle"
              ariaLabel="Exact times mode"
              value={isMultiple ? "multiple" : "once"}
              options={[
                { value: "once", label: "Once a day" },
                { value: "multiple", label: "Multiple times during a day" },
              ]}
              onChange={(v) => {
                if (v === "once") switchToOnceADay();
                else switchToMultiple();
              }}
            />
          </Field>

          {isMultiple ? (
            <Field id="specific-times" label={`Times (up to ${MAX_SPECIFIC_TIMES})`}>
              <SpecificTimesPicker
                value={draft.specificTimes ?? []}
                onChange={(v) => patch({ specificTimes: v })}
              />
            </Field>
          ) : (
            <Field id="once-time" label="Time of day">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-serif-zen italic text-muted-foreground">
                  At
                </span>
                <HourSelect
                  data-id="field-once-time"
                  value={draft.activeHours.start}
                  onChange={(v) =>
                    patch({
                      activeHours: { start: v, end: Math.min(24, v + 1) },
                    })
                  }
                />
              </div>
            </Field>
          )}
        </>
      ) : (
        <Field id="frequency" label="Reminder frequency">
          <Select
            value={String(draft.frequencyMinutes)}
            onValueChange={(v) => patch({ frequencyMinutes: Number(v) })}
          >
            <SelectTrigger data-id="field-frequency-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQ_PRESETS.map((p) => (
                <SelectItem
                  key={p}
                  value={String(p)}
                  data-id={`field-frequency-option-${p}`}
                >
                  {freqLabel(p)}
                </SelectItem>
              ))}
              {!FREQ_PRESETS.includes(draft.frequencyMinutes) &&
                draft.frequencyMinutes < ONCE_A_DAY && (
                  <SelectItem value={String(draft.frequencyMinutes)}>
                    Every {draft.frequencyMinutes} minutes
                  </SelectItem>
                )}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field id="sound" label="Sound">
        <SoundControl
          value={draft.soundId || DEFAULT_SOUND_ID}
          onChange={(v) => patch({ soundId: v })}
        />
      </Field>

      <Button
        data-id="editor-test-notification"
        variant="ghost"
        onClick={async () => {
          const ok = await onPermissionGate();
          if (!ok) {
            // Still play the chime in-app even if OS-level perms aren't granted,
            // so the user can hear what they're picking.
            playBellChime(draft.soundId).catch(() => {
              /* noop */
            });
            return;
          }
          await fireTestNotification(draft);
        }}
      >
        Ring the bell
      </Button>
    </section>
  );
}

function Step3({
  draft,
  patch,
}: {
  draft: Mantra;
  patch: (p: Partial<Mantra>) => void;
}) {
  // In exact-times modes (once-a-day or multiple), the time(s) are chosen in
  // Step 2 — Step 3 only owns active days. The "active hours" range is only
  // meaningful for the interval-based "Choose how often" mode.
  const isExact =
    hasSpecificTimes(draft) || draft.frequencyMinutes >= ONCE_A_DAY;
  return (
    <section data-id="editor-step-3" className="flex flex-col gap-5">
      {!isExact && (
        <Field id="hours" label="Active hours">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-serif-zen italic text-muted-foreground">
              From
            </span>
            <HourSelect
              data-id="field-hours-start"
              value={draft.activeHours.start}
              onChange={(v) =>
                patch({ activeHours: { ...draft.activeHours, start: v } })
              }
            />
            <span className="font-serif-zen italic text-muted-foreground">
              to
            </span>
            <HourSelect
              data-id="field-hours-end"
              value={draft.activeHours.end}
              onChange={(v) =>
                patch({ activeHours: { ...draft.activeHours, end: v } })
              }
            />
          </div>
        </Field>
      )}

      <Field id="days" label="Active days">
        <div data-id="field-days" className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, i) => {
            const on = !!draft.activeDays[i];
            return (
              <button
                key={label}
                type="button"
                data-id={`field-days-${label.toLowerCase()}`}
                data-state={on ? "on" : "off"}
                className={`cursor-pointer rounded-md border px-0 py-2.5 font-serif-zen text-[0.92rem] font-medium tracking-wider transition-colors ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => {
                  const next = [...draft.activeDays];
                  next[i] = !on;
                  patch({ activeDays: next });
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>
    </section>
  );
}

// --- Field + small controls --------------------------------------------------

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section data-id={`field-${id}`} className="flex flex-col gap-2">
      <Label data-id={`field-label-${id}`}>{label}</Label>
      {children}
    </section>
  );
}

function HourSelect({
  value,
  onChange,
  "data-id": dataId,
}: {
  value: number;
  onChange: (v: number) => void;
  "data-id"?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="min-w-[110px] flex-1" data-id={dataId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 25 }, (_, i) => (
          <SelectItem key={i} value={String(i)}>
            {String(i).padStart(2, "0")}:00
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Two-segment pill toggle. Shape mirrors KindToggle so the editor's
// frequency-mode switch reads as a sibling control to the type switch up top.
// Generic over its option value so callers stay typesafe with string unions.
function BinaryToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  dataId,
}: {
  value: T;
  options: [{ value: T; label: string }, { value: T; label: string }];
  onChange: (v: T) => void;
  ariaLabel?: string;
  dataId?: string;
}) {
  const isSecond = value === options[1].value;
  return (
    <div
      data-id={dataId}
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative grid grid-cols-2 rounded-md border border-border bg-card p-1"
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-sm bg-primary/25 transition-transform duration-200 ease-out",
          isSecond ? "translate-x-full" : "translate-x-0",
        )}
      />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-id={dataId ? `${dataId}-${opt.value}` : undefined}
            data-state={active ? "active" : "inactive"}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-[1] cursor-pointer rounded-sm px-3 py-2.5 font-serif-zen text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Five-slot exact-time picker for the "multiple times during a day" mode.
// Slots not turned on render as a greyed-out placeholder so the user can
// see the cap (5) without it feeling busy. The hour picker itself is the
// same HourSelect used elsewhere — keeps everything to whole-hour precision
// to match the once-a-day flow.
function SpecificTimesPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  // Slot order matches insertion order in `value`. We don't sort here so
  // that toggling a slot off and back on stays predictable. The scheduler
  // sorts at fire-time.
  const slots: (number | null)[] = Array.from(
    { length: MAX_SPECIFIC_TIMES },
    (_, i) => (i < value.length ? (value[i] ?? null) : null),
  );

  const commit = (next: (number | null)[]) => {
    onChange(next.filter((h): h is number => h !== null));
  };

  const toggleSlot = (idx: number) => {
    const next = [...slots];
    if (next[idx] === null) {
      next[idx] = nextDefaultHour(
        next.filter((h): h is number => h !== null),
      );
    } else {
      // Don't let the user disable the only remaining active slot — there
      // would be no time for the mantra to fire and the saved row would
      // describe as "at  · ...". Better to keep at least one on.
      const activeCount = next.filter((h) => h !== null).length;
      if (activeCount <= 1) return;
      next[idx] = null;
    }
    commit(next);
  };

  const setHour = (idx: number, hour: number) => {
    const next = [...slots];
    next[idx] = hour;
    commit(next);
  };

  return (
    <div data-id="field-specific-times" className="flex flex-col gap-2">
      {slots.map((hour, i) => {
        const active = hour !== null;
        return (
          <div
            key={i}
            data-id={`specific-times-slot-${i}`}
            data-active={active}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
              active
                ? "border-primary/40 bg-primary/[0.06]"
                : "border-border/60 bg-card opacity-55",
            )}
          >
            <Switch
              data-id={`specific-times-slot-${i}-toggle`}
              checked={active}
              onCheckedChange={() => toggleSlot(i)}
              aria-label={
                active ? `Disable time slot ${i + 1}` : `Enable time slot ${i + 1}`
              }
            />
            {active ? (
              <HourSelect
                data-id={`specific-times-slot-${i}-hour`}
                value={hour as number}
                onChange={(v) => setHour(i, v)}
              />
            ) : (
              <span className="font-serif-zen italic text-muted-foreground">
                Slot {i + 1} — off
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SoundControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div data-id="field-sound" className="flex items-center gap-2">
      <Select
        value={value}
        onValueChange={(v) => {
          onChange(v);
          playBellChime(v).catch(() => {
            /* noop */
          });
        }}
      >
        <SelectTrigger data-id="field-sound-trigger" className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOUNDS.map((s) => (
            <SelectItem
              key={s.id}
              value={s.id}
              data-id={`field-sound-option-${s.id}`}
            >
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        data-id="field-sound-play"
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => {
          playBellChime(value).catch(() => {
            /* noop */
          });
        }}
        title="Play this sound"
        aria-label="Play this sound"
      >
        Play
      </Button>
    </div>
  );
}
