import * as React from 'react';
import { ShieldAlert, Battery, AlarmClock, Power, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReliabilityStatus } from '@/hooks/use-reliability-status';
import { MantraScheduler } from '@/lib/native-mantra-scheduler';
import { getOemAutostartDone, setOemAutostartDone } from '@/lib/storage';

// Pretty-printed brand label for the OEM autostart row.
const OEM_LABEL: Record<string, string> = {
  huawei: 'Huawei',
  honor: 'Honor',
  xiaomi: 'Xiaomi',
  redmi: 'Redmi',
  poco: 'Poco',
  oppo: 'Oppo',
  realme: 'Realme',
  oneplus: 'OnePlus',
  vivo: 'Vivo',
  iqoo: 'iQOO',
  meizu: 'Meizu',
  letv: 'Letv',
  samsung: 'Samsung',
  asus: 'ASUS',
  nokia: 'Nokia',
};

// dontkillmyapp.com slug per brand. Keys must stay lowercase to match
// Build.MANUFACTURER values from the native side.
const DKMA_SLUG: Record<string, string> = {
  huawei: 'huawei',
  honor: 'honor',
  xiaomi: 'xiaomi',
  redmi: 'xiaomi',
  poco: 'xiaomi',
  oppo: 'oppo',
  realme: 'realme',
  oneplus: 'oneplus',
  vivo: 'vivo',
  iqoo: 'vivo',
  meizu: 'meizu',
  letv: 'letv',
  samsung: 'samsung',
  asus: 'asus',
  nokia: 'nokia',
};

function brandLabel(manufacturer: string, brand: string): string {
  return OEM_LABEL[manufacturer] || OEM_LABEL[brand] || 'your phone';
}

function dkmaSlug(manufacturer: string, brand: string): string | null {
  return DKMA_SLUG[manufacturer] || DKMA_SLUG[brand] || null;
}

// Top-level reliability nudge for Android. Renders as null on web / iOS
// and on Android once everything's healthy. The banner is intentionally
// loud — it's the difference between reminders firing and Mantrabe being
// silently broken on aggressive-OEM phones.
export function ReliabilityBanner() {
  const { status, refresh } = useReliabilityStatus();
  const [oemDone, setOemDoneState] = React.useState<boolean>(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    void getOemAutostartDone().then(setOemDoneState);
  }, []);

  if (!status) return null;

  const batteryHealthy = status.ignoringBatteryOptimizations;
  // Pre-API-31 devices have no concept of exact-alarm gating; treat as
  // healthy so the row never surfaces there.
  const exactHealthy = status.sdkInt < 31 ? true : status.exactAlarmsAllowed;
  const oemHealthy = !status.isAggressiveOem || oemDone;

  const allHealthy = batteryHealthy && exactHealthy && oemHealthy;
  if (allHealthy) return null;

  const issueCount =
    (batteryHealthy ? 0 : 1) + (exactHealthy ? 0 : 1) + (oemHealthy ? 0 : 1);

  return (
    <>
      <div
        data-id="reliability-banner"
        className="mx-5 mt-3 flex items-center gap-3 rounded-lg border border-[var(--warn)] bg-[var(--warn)]/10 px-4 py-3 text-sm shadow-[var(--shadow-soft)]"
        role="alert"
      >
        <ShieldAlert
          className="h-5 w-5 flex-shrink-0 text-[var(--warn)]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <strong className="font-medium">Reminders may not fire reliably.</strong>{' '}
          <span className="text-muted-foreground">
            {issueCount > 1
              ? `${issueCount} settings on this phone could silence Mantrabe in the background.`
              : 'A setting on this phone could silence Mantrabe in the background.'}
          </span>
        </div>
        <Button
          data-id="reliability-banner-fix"
          size="sm"
          variant="subtle"
          onClick={() => setOpen(true)}
        >
          Fix it
        </Button>
      </div>

      <ReliabilityDialog
        open={open}
        onOpenChange={setOpen}
        status={status}
        oemDone={oemDone}
        onOemDoneChange={async (next) => {
          await setOemAutostartDone(next);
          setOemDoneState(next);
        }}
        onRefresh={refresh}
      />
    </>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: NonNullable<ReturnType<typeof useReliabilityStatus>['status']>;
  oemDone: boolean;
  onOemDoneChange: (done: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
}

function ReliabilityDialog({
  open,
  onOpenChange,
  status,
  oemDone,
  onOemDoneChange,
  onRefresh,
}: DialogProps) {
  const batteryHealthy = status.ignoringBatteryOptimizations;
  const exactNeeded = status.sdkInt >= 31 && !status.exactAlarmsAllowed;
  const oemNeeded = status.isAggressiveOem && !oemDone;

  const oemName = brandLabel(status.manufacturer, status.brand);
  const slug = dkmaSlug(status.manufacturer, status.brand);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-id="reliability-dialog" className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Make reminders reliable</DialogTitle>
          <DialogDescription>
            Android phones — especially {oemName} — aggressively kill
            background apps to save battery. Walk through these once and
            Mantrabe will keep firing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Row 1: Battery optimization */}
          <Row
            icon={<Battery className="h-5 w-5" />}
            title="Ignore battery optimization"
            done={batteryHealthy}
            description={
              batteryHealthy
                ? 'Mantrabe is allowed to wake the device for reminders.'
                : 'Without this, the OS delays alarms in Doze mode by up to ~9 minutes.'
            }
            actionLabel="Allow"
            onAction={async () => {
              await MantraScheduler.requestIgnoreBatteryOptimizations();
              // The system dialog is async — onResume in the hook will
              // re-poll, but kick a refresh in case the user lingers.
              setTimeout(() => void onRefresh(), 800);
            }}
          />

          {/* Row 2: Exact alarms (API 31+ only) */}
          {exactNeeded && (
            <Row
              icon={<AlarmClock className="h-5 w-5" />}
              title="Allow exact alarms"
              done={false}
              description="Lets Mantrabe schedule on-time reminders instead of getting batched into Doze windows."
              actionLabel="Open settings"
              onAction={async () => {
                await MantraScheduler.openExactAlarmSettings();
                setTimeout(() => void onRefresh(), 800);
              }}
            />
          )}

          {/* Row 3: OEM autostart whitelist (aggressive OEMs only). The
              "done" state is a manual toggle because the system gives us
              no programmatic way to read the OEM auto-start list back. */}
          {status.isAggressiveOem && (
            <Row
              icon={<Power className="h-5 w-5" />}
              title={`Allow autostart on ${oemName}`}
              done={oemDone}
              description={
                oemDone
                  ? `Mantrabe is whitelisted in ${oemName} background protection.`
                  : `${oemName}'s background killer must be told to leave Mantrabe alone, or it will get suspended a few minutes after you close the app.`
              }
              actionLabel="Open autostart"
              onAction={async () => {
                await MantraScheduler.openOemAutostartSettings();
              }}
              extra={
                oemNeeded ? (
                  <button
                    type="button"
                    className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => void onOemDoneChange(true)}
                  >
                    Already done — stop reminding me
                  </button>
                ) : (
                  <button
                    type="button"
                    className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => void onOemDoneChange(false)}
                  >
                    Mark as not done
                  </button>
                )
              }
            />
          )}

          {slug && (
            <a
              data-id="reliability-dialog-dkma"
              href={`https://dontkillmyapp.com/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              {oemName} step-by-step guide
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void | Promise<void>;
  extra?: React.ReactNode;
}

function Row({ icon, title, description, done, actionLabel, onAction, extra }: RowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-start gap-3">
        <div className={done ? 'text-emerald-600' : 'text-foreground/70'}>
          {done ? <Check className="h-5 w-5" /> : icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant={done ? 'subtle' : 'default'}
          onClick={() => void onAction()}
        >
          {actionLabel}
        </Button>
        {extra}
      </div>
    </div>
  );
}
