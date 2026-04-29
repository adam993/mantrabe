interface Props {
  current: number;
  total: number;
}

export function StepIndicator({ current, total }: Props) {
  return (
    <div
      data-id="step-indicator"
      className="flex items-center justify-center gap-2"
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const isActive = n === current;
        const isDone = n < current;
        return (
          <div
            key={n}
            data-id={`step-indicator-${n}`}
            data-state={isActive ? 'active' : isDone ? 'done' : 'pending'}
            className={`h-1.5 rounded-full transition-all ${
              isActive
                ? 'w-8 bg-primary'
                : isDone
                  ? 'w-4 bg-primary/60'
                  : 'w-4 bg-[var(--border-strong)]/60'
            }`}
          />
        );
      })}
    </div>
  );
}
