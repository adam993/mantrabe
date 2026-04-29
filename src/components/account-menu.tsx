import * as React from 'react';
import { LogIn, LogOut, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { SignInDialog } from '@/components/sign-in-dialog';

interface Props {
  syncing: boolean;
  onSyncNow: () => void;
}

export function AccountMenu({ syncing, onSyncNow }: Props) {
  const { enabled, user, loading, signOut } = useAuth();
  const [signInOpen, setSignInOpen] = React.useState(false);

  if (!enabled) return null;
  if (loading) {
    return (
      <Button
        data-id="account-menu-loading"
        variant="ghost"
        size="icon"
        className="opacity-50"
        aria-label="Loading account"
        disabled
      >
        <Cloud className="h-4 w-4" />
      </Button>
    );
  }

  if (!user) {
    return (
      <>
        <Button
          data-id="account-menu-sign-in"
          variant="ghost"
          size="sm"
          onClick={() => setSignInOpen(true)}
          aria-label="Sign in to sync"
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
        <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
      </>
    );
  }

  const initial =
    (user.user_metadata?.['full_name'] as string | undefined)?.trim()?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    '◯';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-id="account-menu-trigger"
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card font-serif-zen text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-id="account-menu-content" align="end">
        <DropdownMenuLabel data-id="account-menu-email">
          {user.email || 'Signed in'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-id="account-menu-sync-now"
          onSelect={onSyncNow}
          disabled={syncing}
        >
          {syncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4" />
          )}
          {syncing ? 'Syncing…' : 'Sync now'}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-id="account-menu-sign-out"
          onSelect={() => {
            signOut().catch((err) => console.error('signOut failed:', err));
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div
          data-id="account-menu-local-note"
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
        >
          <CloudOff className="h-3 w-3" />
          Local data stays on this device.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
