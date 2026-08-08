/**
 * The chat transcript pane. Renders the open conversation's messages —
 * user bubbles, AI prose with rig cards, and error rows — plus the
 * memory-loss banner when resumed history couldn't be reused. It stays
 * mounted across pane switches so its scroll position survives
 * (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'
import { RigCard } from './rig-card'

@Component({
  selector: 'ot-chat-pane',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RigCard],
  template: `
    <div class="scroll">
      @if (!desktop.ready()) {
        <p class="empty">{{ i18n.t('shell.empty.loading') }}</p>
      } @else if (desktop.loadError()) {
        <p class="empty error">{{ i18n.t('shell.error.loadState') }}</p>
      } @else if (desktop.transcript().length === 0) {
        <p class="empty">{{ i18n.t('shell.empty.chat') }}</p>
      } @else {
        @if (memoryLost()) {
          <div class="memory-loss">{{ i18n.t('chat.memoryLost') }}</div>
        }
        @for (message of desktop.transcript(); track msgKey($index, message.role)) {
          @switch (message.role) {
            @case ('user') {
              <div class="row user">
                <span class="who">{{ i18n.t('shell.chat.you') }}</span>
                <div class="bubble">{{ message.text }}</div>
              </div>
            }
            @case ('error') {
              <div class="row error">
                <span class="who">{{ i18n.t('shell.chat.error') }}</span>
                <div class="bubble error">{{ message.text }}</div>
              </div>
            }
            @default {
              <div class="row ai">
                <span class="who">{{ i18n.t('shell.chat.assistant') }}</span>
                @if (message.text) {
                  <div class="prose">{{ message.text }}</div>
                }
                @if (message.rig) {
                  <ot-rig-card [rig]="message.rig" [cards]="message.cards ?? null" />
                }
              </div>
            }
          }
        }
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
        padding: 14px 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .empty {
        margin: 0;
        color: var(--text-dim);
      }
      .empty.error {
        color: var(--danger);
      }
      .memory-loss {
        padding: 8px 10px;
        border: 1px solid var(--warning);
        border-radius: var(--r-sm);
        background: var(--warning);
        color: #1a1206;
        font-size: 12px;
      }
      .row {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .who {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 9.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-faint);
      }
      .bubble,
      .prose {
        color: var(--text);
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .user .bubble {
        align-self: flex-start;
        padding: 8px 10px;
        border-radius: var(--r-md);
        background: var(--surface-raised);
        border: 1px solid var(--border);
      }
      .error .bubble {
        color: var(--danger);
      }
    `,
  ],
})
export class ChatPane {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

  readonly memoryLost = () => this.desktop.currentConversation()?.memoryLost === true

  /** Orders stable; role is enough inside one conversation, indexed by position. */
  msgKey(index: number, role: string): string {
    return `${index}-${role}`
  }
}