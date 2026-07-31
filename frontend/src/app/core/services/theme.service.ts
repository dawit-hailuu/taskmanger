import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'taskflow.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.readInitialTheme());

  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const theme = this._theme();
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
    });
  }

  toggle(): void {
    this._theme.set(this._theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this._theme.set(theme);
  }

  private readInitialTheme(): Theme {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
