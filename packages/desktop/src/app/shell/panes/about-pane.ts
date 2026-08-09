/**
 * The About pane: app identity, version from `DesktopService`, and the tagline.
 * Reads signals, emits `back` through the shared `PaneHeader` — it never
 * touches `window.api` (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core'
import { LucideGuitar } from '@lucide/angular'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'
import { PaneHeader } from '../pane-header'

@Component({
  selector: 'ot-about-pane',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideGuitar, PaneHeader],
  template: `
    <ot-pane-header [title]="i18n.t('shell.menu.about')" (back)="back.emit()" />
    <div class="body">
      <div class="icon">
        <svg lucideGuitar [size]="40"></svg>
      </div>
      <h1 class="name">{{ i18n.t('shell.appName') }} <i>{{ i18n.t('about.platform') }}</i></h1>
      <p class="version">{{ i18n.t('shell.status.version', { version: desktop.version() }) }}</p>
      <p class="tagline">{{ i18n.t('about.tagline') }}</p>
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
      .body {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 24px;
        text-align: center;
      }
      .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: var(--r-md);
        background: var(--accent-soft);
        color: var(--accent-strong);
      }
      .name {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 20px;
        color: var(--text);
      }
      .name i {
        font-style: italic;
        font-weight: 500;
        color: var(--text-dim);
      }
      .version {
        margin: 0;
        font-size: 12px;
        color: var(--text-faint);
      }
      .tagline {
        margin: 0;
        max-width: 260px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-dim);
      }
    `,
  ],
})
export class AboutPane {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
  readonly back = output<void>()
}