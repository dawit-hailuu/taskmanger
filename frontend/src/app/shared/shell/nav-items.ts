/** One entry in the primary navigation. */
export interface NavItem {
  label: string;
  route: string;
  /** Single glyph shown in the collapsed (icon-only) sidebar. */
  glyph: string;
  /** True when the route should only match exactly (e.g. the index route). */
  exact?: boolean;
}

/**
 * The app's primary navigation, in one place so the sidebar, the mobile drawer
 * and the keyboard shortcuts can't drift out of sync.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', route: '/dashboard', glyph: '◱', exact: true },
  { label: 'Tasks', route: '/tasks', glyph: '☰' },
  { label: 'Workspaces', route: '/workspaces', glyph: '▦' },
  { label: 'Profile', route: '/profile', glyph: '☺' },
  { label: 'Settings', route: '/settings', glyph: '⚙' },
];
