/**
 * The window's drag region: app name, version, and the always-on-top pin.
 * Reads state from `DesktopService` and emits intent; it never touches
 * `window.api` (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { LucidePin, LucidePinOff } from '@lucide/angular'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-titlebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucidePin, LucidePinOff],
  template: `
    <div class="brand">
      <span class="name">{{ i18n.t('shell.appName') }}</span>
      <span class="version">{{
        desktop.version() ? i18n.t('shell.status.version', { version: desktop.version() }) : ''
      }}</span>
    </div>
    <button
      class="pin"
      type="button"
      [attr.aria-pressed]="desktop.alwaysOnTop()"
      [attr.title]="i18n.t('shell.pin.title')"
      [attr.aria-label]="i18n.t('shell.pin.title')"
      (click)="desktop.toggleAlwaysOnTop()"
    >
      @if (desktop.alwaysOnTop()) {
        <svg lucidePin [size]="16"></svg>
      } @else {
        <svg lucidePinOff [size]="16"></svg>
      }
    </button>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        height: 40px;
        padding: 0 10px;
        background: var(--surface-chrome);
        border-bottom: 1px solid var(--border);
        -webkit-app-region: drag;
      }
      .brand {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
      }
      .name {
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.02em;
        color: var(--text);
        white-space: nowrap;
      }
      .version {
        font-family: var(--font-display);
        font-size: 10px;
        color: var(--text-faint);
        white-space: nowrap;
      }
      .pin {
        -webkit-app-region: no-drag;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text-dim);
        cursor: pointer;
      }
      .pin:hover {
        background: var(--surface-raise);
        color: var(--text);
      }
      .pin[aria-pressed='true'] {
        color: var(--accent);
      }
    `,
  ],
})
export class TitleBar {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
}