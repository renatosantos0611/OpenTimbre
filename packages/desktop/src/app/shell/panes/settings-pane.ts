/**
 * Settings pane: theme, locale, window-behavior toggles, guitar, AI, and keys.
 * Each control forwards intent to `DesktopService`; the active value is read
 * from its signals, so a change from the main process (push) re-renders here
 * too. The heavier sections live in `GuitarForm` and `AiSettings`.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core'
import type { Locale } from '@opentimbre/i18n'
import type { Theme } from '@opentimbre/contracts'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'
import { GuitarForm } from './guitar-form'
import { AiSettings } from './ai-settings'
import { PaneHeader } from '../pane-header'

@Component({
  selector: 'ot-settings-pane',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuitarForm, AiSettings, PaneHeader],
  template: `
    <ot-pane-header [title]="i18n.t('settings.title')" (back)="back.emit()" />
    <div class="scroll">
      <ot-guitar-form />

      <ot-ai-settings />

      <fieldset class="group">
        <legend>{{ i18n.t('settings.theme') }}</legend>
        <div class="seg" role="group" [attr.aria-label]="i18n.t('settings.theme')">
          @for (theme of themes; track theme) {
            <button
              type="button"
              class="seg-btn"
              [attr.aria-pressed]="theme === activeTheme()"
              (click)="setTheme(theme)"
            >
              {{ themeMap()[theme] }}
            </button>
          }
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>{{ i18n.t('settings.locale') }}</legend>
        <div class="seg" role="group" [attr.aria-label]="i18n.t('settings.locale')">
          @for (loc of locales; track loc) {
            <button
              type="button"
              class="seg-btn"
              [attr.aria-pressed]="loc === desktop.locale()"
              (click)="setLocale(loc)"
            >
              {{ locLabel()[loc] }}
            </button>
          }
        </div>
      </fieldset>

      <label class="toggle">
        <input
          type="checkbox"
          [attr.aria-label]="i18n.t('settings.dimOnUnfocus')"
          [checked]="desktop.dimOnUnfocus()"
          (change)="desktop.setDimOnUnfocus($any($event.target).checked)"
        />
        <span>{{ i18n.t('settings.dimOnUnfocus') }}</span>
      </label>

      <label class="toggle">
        <input
          type="checkbox"
          [attr.aria-label]="i18n.t('settings.alwaysOnTop')"
          [checked]="desktop.alwaysOnTop()"
          (change)="desktop.toggleAlwaysOnTop()"
        />
        <span>{{ i18n.t('settings.alwaysOnTop') }}</span>
      </label>

      <label class="toggle">
        <input
          type="checkbox"
          [attr.aria-label]="i18n.t('settings.autoApply')"
          [checked]="desktop.autoApply()"
          (change)="desktop.setAutoApply($any($event.target).checked)"
        />
        <span>{{ i18n.t('settings.autoApply') }}</span>
      </label>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .scroll {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      }
      .group {
        border: 0;
        padding: 0;
        margin: 0 0 16px;
      }
      legend {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 12px;
        color: var(--text-dim);
        margin-bottom: 6px;
      }
      .seg {
        display: flex;
        gap: 6px;
      }
      .seg-btn {
        flex: 1;
        padding: 7px 10px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text-dim);
        font-family: var(--font-ui);
        font-size: 13px;
        cursor: pointer;
      }
      .seg-btn[aria-pressed='true'] {
        border-color: var(--accent-line);
        background: var(--accent-soft);
        color: var(--accent-strong);
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        color: var(--text);
        cursor: pointer;
      }
      .toggle input {
        accent-color: var(--accent);
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class SettingsPane {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
  readonly back = output<void>()

  readonly themes: Theme[] = ['system', 'light', 'dark']
  readonly locales: Locale[] = ['en', 'pt']

  readonly themeMap = computed(() => ({
    system: this.i18n.t('settings.theme.system'),
    light: this.i18n.t('settings.theme.light'),
    dark: this.i18n.t('settings.theme.dark'),
  }))

  readonly locLabel = computed(() => ({
    en: this.i18n.t('settings.locale.en'),
    pt: this.i18n.t('settings.locale.pt'),
  }))

  readonly activeTheme = computed(() => this.desktop.themeChosen())

  setTheme(theme: Theme): void {
    void this.desktop.setTheme(theme)
  }

  setLocale(locale: Locale): void {
    void this.desktop.setLocale(locale)
  }
}