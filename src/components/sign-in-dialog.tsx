import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SignInForm } from '@/components/sign-in-form';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-id="sign-in-dialog" className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle data-id="sign-in-dialog-title">Sign in to sync</DialogTitle>
          <DialogDescription data-id="sign-in-dialog-description">
            Optional. Your mantras will sync across devices. You can keep using
            Mantrabe without an account.
          </DialogDescription>
        </DialogHeader>

        <SignInForm
          layout="dialog"
          idPrefix="sign-in-dialog"
          resetSignal={open}
        />
      </DialogContent>
    </Dialog>
  );
}
