/**
 * Shared header for the secondary panes (History, Settings, About): a back
 * button that returns to the chat pane and the pane's title. Emits intent;
 * the shell decides which pane becomes active (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, inject, output, input } from '@angular/core'
import { LucideArrowLeft } from '@lucide/angular'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-pane-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideArrowLeft],
  template: `
    <div class="header">
      <button
        class="back"
        type="button"
        [attr.aria-label]="i18n.t('shell.back')"
        [attr.title]="i18n.t('shell.back')"
        (click)="back.emit()"
      >
        <svg lucideArrowLeft [size]="16"></svg>
      </button>
      <h2 class="title">{{ title() }}</h2>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        flex: none;
        border-bottom: 1px solid var(--border);
        background: var(--surface-chrome);
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 10px;
      }
      .back {
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
      .back:hover {
        background: var(--surface-raise);
        color: var(--text);
      }
      .title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.02em;
        color: var(--text);
      }
    `,
  ],
})
export class PaneHeader {
  readonly i18n = inject(I18nService)
  readonly title = input<string>('')
  readonly back = output<void>()
}