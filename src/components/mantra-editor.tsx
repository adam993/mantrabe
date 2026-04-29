import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ONCE_A_DAY } from '@/lib/scheduler';
import { SOUNDS, DEFAULT_SOUND_ID } from '@/lib/sounds';
import { playBellChime } from '@/lib/bell-chime';
import { fireTestNotification } from '@/lib/notifications';
import { makeMantra } from '@/lib/storage';
import { KindToggle } from '@/components/kind-toggle';
import { StepIndicator } from '@/components/step-indicator';
import type { EntryKind, Mantra } from '@/types/mantra';

interface Props {
  initial: Mantra | null;
  onCancel: () => void;
  onSave: (mantra: Mantra) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onPermissionGate: () => Promise<boolean>;
}

type Step = 1 | 2 | 3;
const TOTAL_STEPS = 3;

const FREQ_PRESETS: number[] = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240, ONCE_A_DAY];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PLACEHOLDER: Record<EntryKind, string> = {
  mantra: 'e.g. Everything is fine.',
  reminder: 'e.g. Drink a glass of water.',
};

const STEP_TITLES: Record<Step, string> = {
  1: 'What to remember',
  2: 'How often & how it sounds',
  3: 'When to ring',
};

function freqLabel(p: number): string {
  if (p >= ONCE_A_DAY) return 'Once a day';
  if (p < 60) return `Every ${p} minutes`;
  if (p === 60) return 'Every hour';
  return `Every ${p / 60} hours`;
}

export function MantraEditor({
  initial,
  onCancel,
  onSave,
  onDelete,
  onPermissionGate,
}: Props) {
  const [draft, setDraft] = React.useState<Mantra>(() => initial ?? makeMantra({}));
  const [step, setStep] = React.useState<Step>(1);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const canAdvance = step !== 1 || draft.text.trim().length > 0;
  const isLast = step === TOTAL_STEPS;
  const isReminder = draft.kind === 'reminder';

  const patch = (p: Partial<Mantra>) => setDraft((d) => ({ ...d, ...p }));

  const goNext = async () => {
    if (!canAdvance) return;
    if (isLast) {
      const next: Mantra = { ...draft, text: draft.text.trim() };
      await onSave(next);
      onPermissionGate().catch((err) => console.error('permission gate failed:', err));
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
          {step === 1 ? 'Cancel' : '← Back'}
        </Button>
        <div
          data-id="editor-title"
          className="flex flex-1 items-center justify-center font-serif-zen text-[1.25rem] font-medium tracking-wide"
        >
          {initial
            ? `Edit ${draft.kind}`
            : `New ${draft.kind}`}
        </div>
        <Button
          data-id="editor-next"
          onClick={goNext}
          disabled={!canAdvance}
        >
          {isLast ? 'Save' : 'Next'}
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
        <Step1
          draft={draft}
          patch={patch}
          isReminder={isReminder}
        />
      )}
      {step === 2 && (
        <Step2
          draft={draft}
          patch={patch}
          onPermissionGate={onPermissionGate}
        />
      )}
      {step === 3 && <Step3 draft={draft} patch={patch} />}

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
              Stops scheduled reminders for this {draft.kind}. If you're signed in, it will be
              removed from your synced mantras as well.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-id="editor-delete-cancel">Cancel</AlertDialogCancel>
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
      <Field id="mantra" label={isReminder ? 'Reminder' : 'Mantra'}>
        <Textarea
          data-id="field-mantra-textarea"
          rows={3}
          maxLength={270}
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
  return (
    <section data-id="editor-step-2" className="flex flex-col gap-5">
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
              <SelectItem key={p} value={String(p)} data-id={`field-frequency-option-${p}`}>
                {freqLabel(p)}
              </SelectItem>
            ))}
            {!FREQ_PRESETS.includes(draft.frequencyMinutes) && (
              <SelectItem value={String(draft.frequencyMinutes)}>
                Every {draft.frequencyMinutes} minutes
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </Field>

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
  const onceADay = draft.frequencyMinutes >= ONCE_A_DAY;
  return (
    <section data-id="editor-step-3" className="flex flex-col gap-5">
      <Field id="hours" label={onceADay ? 'Time of day' : 'Active hours'}>
        {onceADay ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-serif-zen italic text-muted-foreground">At</span>
            <HourSelect
              data-id="field-hours-once"
              value={draft.activeHours.start}
              onChange={(v) => patch({ activeHours: { start: v, end: Math.min(24, v + 1) } })}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-serif-zen italic text-muted-foreground">From</span>
            <HourSelect
              data-id="field-hours-start"
              value={draft.activeHours.start}
              onChange={(v) => patch({ activeHours: { ...draft.activeHours, start: v } })}
            />
            <span className="font-serif-zen italic text-muted-foreground">to</span>
            <HourSelect
              data-id="field-hours-end"
              value={draft.activeHours.end}
              onChange={(v) => patch({ activeHours: { ...draft.activeHours, end: v } })}
            />
          </div>
        )}
      </Field>

      <Field id="days" label="Active days">
        <div data-id="field-days" className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, i) => {
            const on = !!draft.activeDays[i];
            return (
              <button
                key={label}
                type="button"
                data-id={`field-days-${label.toLowerCase()}`}
                data-state={on ? 'on' : 'off'}
                className={`cursor-pointer rounded-md border px-0 py-2.5 font-serif-zen text-[0.92rem] font-medium tracking-wider transition-colors ${
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
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
  'data-id': dataId,
}: {
  value: number;
  onChange: (v: number) => void;
  'data-id'?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="min-w-[110px] flex-1" data-id={dataId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 25 }, (_, i) => (
          <SelectItem key={i} value={String(i)}>
            {String(i).padStart(2, '0')}:00
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
            <SelectItem key={s.id} value={s.id} data-id={`field-sound-option-${s.id}`}>
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
