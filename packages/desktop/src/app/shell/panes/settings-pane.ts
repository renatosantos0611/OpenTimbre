/**
 * Settings pane, regrouped to the legacy's four sections: Sua guitarra,
 * Inteligência artificial, Aparência, and Janela — each with a heading and an
 * explanatory line. Each control forwards intent to `DesktopService`; the
 * active value is read from its signals, so a change from the main process
 * (push) re-renders here too. The heavier sections live in `GuitarForm` and
 * `AiSettings`.
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
      <section class="group">
        <h2 class="group-title">{{ i18n.t('settings.guitarTitle') }}</h2>
        <p class="group-sub">{{ i18n.t('settings.guitarSub') }}</p>
        <ot-guitar-form />
      </section>

      <section class="group">
        <h2 class="group-title">{{ i18n.t('settings.aiTitle') }}</h2>
        <p class="group-sub">{{ i18n.t('settings.aiSub') }}</p>
        <ot-ai-settings />
      </section>

      <section class="group">
        <h2 class="group-title">{{ i18n.t('settings.appearanceTitle') }}</h2>
        <p class="group-sub">{{ i18n.t('settings.appearanceSub') }}</p>
        <fieldset>
          <label class="field-label">{{ i18n.t('settings.theme') }}</label>
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
        <fieldset>
          <label class="field-label">{{ i18n.t('settings.locale') }}</label>
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
      </section>

      <section class="group">
        <h2 class="group-title">{{ i18n.t('settings.windowTitle') }}</h2>
        <label class="option">
          <input
            type="checkbox"
            [attr.aria-label]="i18n.t('settings.window.onTop')"
            [checked]="desktop.alwaysOnTop()"
            (change)="desktop.toggleAlwaysOnTop()"
          />
          <span>
            <b>{{ i18n.t('settings.window.onTop') }}</b>
            <em>{{ i18n.t('settings.window.onTopDesc') }}</em>
          </span>
        </label>
        <label class="option">
          <input
            type="checkbox"
            [attr.aria-label]="i18n.t('settings.window.dim')"
            [checked]="desktop.dimOnUnfocus()"
            (change)="desktop.setDimOnUnfocus($any($event.target).checked)"
          />
          <span>
            <b>{{ i18n.t('settings.window.dim') }}</b>
            <em>{{ i18n.t('settings.window.dimDesc') }}</em>
          </span>
        </label>
      </section>
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
        margin: 0 0 22px;
      }
      .group-title {
        margin: 0 0 2px;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
      }
      .group-sub {
        margin: 0 0 10px;
        font-size: 12px;
        line-height: 1.4;
        color: var(--text-dim);
      }
      fieldset {
        border: 0;
        padding: 0;
        margin: 0 0 12px;
      }
      .field-label {
        display: block;
        font-size: 12px;
        color: var(--text-dim);
        margin-bottom: 4px;
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
      .option {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 0;
        cursor: pointer;
      }
      .option input {
        accent-color: var(--accent);
        width: 16px;
        height: 16px;
        margin-top: 2px;
        flex: none;
      }
      .option span {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .option b {
        font-weight: 600;
        font-size: 13px;
        color: var(--text);
      }
      .option em {
        font-style: normal;
        font-size: 12px;
        color: var(--text-dim);
        line-height: 1.4;
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