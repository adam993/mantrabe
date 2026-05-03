import { Button } from '@/components/ui/button';
import { BonsaiIcon } from './bonsai-icon';

interface BonsaiButtonProps {
  onClick: () => void;
}

/**
 * Entry-point button on the mantra list. Sits at the bottom of the list,
 * beneath the existing add-mantra controls. Tapping navigates to the
 * standalone bonsai page.
 */
export function BonsaiButton({ onClick }: BonsaiButtonProps) {
  return (
    <Button
      data-id="list-bonsai-button"
      variant="ghost"
      size="lg"
      onClick={onClick}
      aria-label="Open serenity bonsai"
      title="Open serenity bonsai"
      className="mt-2 inline-flex items-center gap-2 self-center rounded-full border border-border bg-card px-5 py-3 font-serif-zen text-[1rem] tracking-wide text-foreground hover:bg-secondary"
    >
      <BonsaiIcon size={22} className="text-foreground" />
      <span>Sit with your bonsai</span>
    </Button>
  );
}
