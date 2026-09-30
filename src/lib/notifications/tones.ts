import type { NotificationSeverity } from '@/lib/constants';

/** Maps a notification severity to a badge tone. */
export const NOTIFICATION_TONE: Record<NotificationSeverity, 'info' | 'success' | 'warning' | 'danger'> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
};
