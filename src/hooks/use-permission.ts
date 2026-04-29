import * as React from 'react';
import {
  requestPermission as requestPermissionImpl,
  getPermissionState,
} from '@/lib/notifications';
import { getPermissionAsked, setPermissionAsked } from '@/lib/storage';

type Permission = NotificationPermission | 'prompt';

export function usePermission(): {
  permission: Permission;
  request: () => Promise<boolean>;
  ensure: () => Promise<boolean>;
} {
  const [permission, setPermission] = React.useState<Permission>('default');

  React.useEffect(() => {
    getPermissionState()
      .then(setPermission)
      .catch((err) => console.error('getPermissionState failed:', err));
  }, []);

  const request = React.useCallback(async () => {
    await setPermissionAsked();
    const granted = await requestPermissionImpl();
    const next = granted ? 'granted' : await getPermissionState();
    setPermission(next);
    return granted;
  }, []);

  // First-time gate: ask if we haven't already prompted. If the user has
  // been asked before and didn't grant, don't re-prompt — they can use the
  // banner to opt in later.
  const ensure = React.useCallback(async () => {
    if (permission === 'granted') return true;
    const asked = await getPermissionAsked();
    if (asked) return false;
    return request();
  }, [permission, request]);

  return { permission, request, ensure };
}
