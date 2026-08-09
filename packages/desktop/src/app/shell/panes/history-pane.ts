/**
 * The saved-conversations pane. Loads the summary list through
 * `DesktopService`, opens a conversation on click, and deletes through an
 * accessible in-renderer confirmation — never a native blocking dialog.
 * Empty and loading states are designed, not leftovers (see `pelizzai-frontend`).
 */
import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core'
import { LucideClock, LucideTrash2 } from '@lucide/angular'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'
import { PaneHeader } from '../pane-header'

@Component({
  selector: 'ot-history-pane',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideClock, LucideTrash2, PaneHeader],
  template: `
    <ot-pane-header [title]="i18n.t('shell.paneHeader.history')" (back)="back.emit()" />
    <div class="scroll">
      @if (desktop.conversations().length === 0) {
        <span class="empty">
          <svg lucideClock [size]="16"></svg>
          {{ i18n.t('shell.empty.history') }}
        </span>
      } @else {
        @if (confirmingId()) {
          <div class="confirm" role="alertdialog" [attr.aria-label]="i18n.t('history.delete.title')">
            <p class="confirm-text">{{ i18n.t('history.delete.ask') }}</p>
            <div class="confirm-actions">
              <button class="ghost" type="button" (click)="confirmingId.set(null)">
                {{ i18n.t('history.delete.cancel') }}
              </button>
              <button class="danger" type="button" (click)="confirmDelete()">
                {{ i18n.t('history.delete.confirm') }}
              </button>
            </div>
          </div>
        }
        <ul class="list">
          @for (item of desktop.conversations(); track item.id) {
            <li [class.is-current]="item.id === desktop.currentConversation()?.id">
              <button class="row" type="button" (click)="open(item.id)">
                <span class="row-main">
                  <span class="row-title">{{ item.title }}</span>
                  <span class="row-meta">{{ item.turns }} · {{ item.updatedAt }}</span>
                </span>
              </button>
              <button
                class="del"
                type="button"
                [attr.aria-label]="i18n.t('history.delete.label', { title: item.title })"
                (click)="askDelete(item.id)"
              >
                <svg lucideTrash2 [size]="14"></svg>
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
      .empty {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-dim);
      }
      .confirm {
        border: 1px solid var(--danger);
        border-radius: var(--r-md);
        background: var(--danger-soft);
        padding: 10px 12px;
        margin-bottom: 10px;
      }
      .confirm-text {
        margin: 0 0 8px;
        color: var(--text);
        font-size: 13px;
      }
      .confirm-actions {
        display: flex;
        gap: 8px;
      }
      .ghost,
      .danger {
        padding: 5px 10px;
        border-radius: var(--r-sm);
        font-family: var(--font-ui);
        font-size: 12px;
        cursor: pointer;
      }
      .ghost {
        border: 1px solid var(--border);
        background: var(--surface-raised);
        color: var(--text);
      }
      .danger {
        border: 0;
        background: var(--danger);
        color: #fff;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      li {
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
      }
      li.is-current {
        border-color: var(--accent-line);
      }
      .row {
        flex: 1;
        min-width: 0;
        display: flex;
        text-align: left;
        padding: 8px 10px;
        border: 0;
        background: transparent;
        color: var(--text);
        cursor: pointer;
        font-family: var(--font-ui);
      }
      .row-main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
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
      .del {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        flex: none;
        margin-right: 6px;
        border: 0;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text-faint);
        cursor: pointer;
      }
      .del:hover {
        background: var(--danger-soft);
        color: var(--danger);
      }
    `,
  ],
})
export class HistoryPane implements OnInit {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

  readonly back = output<void>()
  readonly confirmingId = signal<string | null>(null)

  ngOnInit(): void {
    void this.desktop.listConversations()
  }

  open(id: string): void {
    void this.desktop.openConversation(id)
  }

  askDelete(id: string): void {
    this.confirmingId.set(id)
  }

  async confirmDelete(): Promise<void> {
    const id = this.confirmingId()
    if (!id) return
    this.confirmingId.set(null)
    await this.desktop.deleteConversation(id)
  }
}