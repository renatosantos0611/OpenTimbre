/**
 * The saved-conversations pane. Loads the summary list through
 * `DesktopService` and lets the user open a conversation; the transcript
 * itself is rendered in the chat pane (Task 9-10). Empty and loading states
 * are designed, not leftovers (see `pelizzai-frontend`).
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core'
import { LucideClock } from '@lucide/angular'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'

@Component({
  selector: 'ot-history-pane',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideClock],
  template: `
    <div class="scroll">
      <p class="label">{{ i18n.t('shell.pane.history') }}</p>
      @if (desktop.conversations().length === 0) {
        <span class="empty">
          <svg lucideClock [size]="16"></svg>
          {{ i18n.t('shell.empty.history') }}
        </span>
      } @else {
        <ul class="list">
          @for (item of desktop.conversations(); track item.id) {
            <li>
              <button class="row" type="button" (click)="open(item.id)">
                <span class="row-title">{{ item.title }}</span>
                <span class="row-meta">{{ item.turns }} · {{ item.updatedAt }}</span>
              </button>
            </li>
          }
        </ul>
      }
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
      .label {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 9.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-faint);
        margin: 0 0 10px;
      }
      .empty {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-dim);
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        text-align: left;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text);
        cursor: pointer;
        font-family: var(--font-ui);
      }
      .row:hover {
        border-color: var(--border-strong);
      }
      .row-title {
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row-meta {
        color: var(--text-faint);
        font-size: 12px;
      }
    `,
  ],
})
export class HistoryPane implements OnInit {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

  ngOnInit(): void {
    void this.desktop.listConversations()
  }

  open(id: string): void {
    void this.desktop.openConversation(id)
  }
}