export interface Profile {
  id: number;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  accountStatus: string;
  avatarUrl: string | null;
  bio: string | null;
  phone: string | null;
  timezone: string;
  createdAt: string;
}

export interface UpdateProfileRequest {
  name: string;
  bio: string | null;
  phone: string | null;
  timezone: string;
}

export interface NotificationPreferences {
  emailTaskAssigned: boolean;
  emailDeadlineApproaching: boolean;
  emailComment: boolean;
  emailMention: boolean;
  emailStatusChange: boolean;
  emailProjectInvite: boolean;
  inAppTaskAssigned: boolean;
  inAppDeadlineApproaching: boolean;
  inAppComment: boolean;
  inAppMention: boolean;
  inAppStatusChange: boolean;
  inAppProjectInvite: boolean;
}

export interface UserActivity {
  id: number;
  type: string;
  description: string | null;
  createdAt: string;
}

export interface LoginHistoryEntry {
  id: number;
  success: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** Human-readable labels for UserActivity.type values. */
export const ACTIVITY_LABELS: Record<string, string> = {
  ACCOUNT_CREATED: 'Account created',
  EMAIL_VERIFIED: 'Email verified',
  PASSWORD_CHANGED: 'Password changed',
  PROFILE_UPDATED: 'Profile updated',
  AVATAR_UPDATED: 'Profile picture updated',
  AVATAR_REMOVED: 'Profile picture removed',
  NOTIFICATION_PREFERENCES_UPDATED: 'Notification preferences updated',
};

/** Notification preference rows shown as a table in Settings: [key, label]. */
export const NOTIFICATION_EVENTS: Array<{
  label: string;
  emailKey: keyof NotificationPreferences;
  inAppKey: keyof NotificationPreferences;
}> = [
  { label: 'Assigned a task', emailKey: 'emailTaskAssigned', inAppKey: 'inAppTaskAssigned' },
  {
    label: 'Deadline approaching',
    emailKey: 'emailDeadlineApproaching',
    inAppKey: 'inAppDeadlineApproaching',
  },
  { label: 'New comment', emailKey: 'emailComment', inAppKey: 'inAppComment' },
  { label: 'Mentioned in a comment', emailKey: 'emailMention', inAppKey: 'inAppMention' },
  { label: 'Task status changes', emailKey: 'emailStatusChange', inAppKey: 'inAppStatusChange' },
  {
    label: 'Project invitation',
    emailKey: 'emailProjectInvite',
    inAppKey: 'inAppProjectInvite',
  },
];

/** Common IANA timezones for the profile form's dropdown. */
export const COMMON_TIMEZONES: string[] = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Africa/Addis_Ababa',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];
