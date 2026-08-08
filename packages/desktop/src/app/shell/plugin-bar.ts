/**
 * Reserved band for the installed plugins. Plugin catalogs and card actions are
 * Tasks 9-10; this shell only fixes the band and its empty state so the window
 * has a stable place for them.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { LucideAudioLines } from '@lucide/angular'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-plugin-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAudioLines],
  template: `
    <span class="label">{{ i18n.t('shell.plugin.title') }}</span>
    <span class="empty">
      <svg lucideAudioLines [size]="14"></svg>
      {{ i18n.t('shell.plugin.empty') }}
    </span>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 34px;
        padding: 0 10px;
        background: var(--surface-chrome);
        border-bottom: 1px solid var(--border);
        font-size: 12px;
        overflow: hidden;
      }
      .label {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 9.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-faint);
        flex: none;
      }
      .empty {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--text-faint);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class PluginBar {
  readonly i18n = inject(I18nService)
}