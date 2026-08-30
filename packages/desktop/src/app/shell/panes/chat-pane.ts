/**
 * The chat transcript pane. Renders the open conversation's messages —
 * user bubbles, AI prose with rig cards, and error rows — plus the
 * memory-loss banner when resumed history couldn't be reused. It stays
 * mounted across pane switches so its scroll position survives
 * (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core'
import { LucideSlidersVertical } from '@lucide/angular'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'
import { RigCard } from './rig-card'

@Component({
  selector: 'ot-chat-pane',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RigCard, LucideSlidersVertical],
  template: `
    <div #scroll class="scroll">
      @if (!desktop.ready()) {
        <p class="empty">{{ i18n.t('shell.empty.loading') }}</p>
      } @else if (desktop.loadError()) {
        <p class="empty error">{{ i18n.t('shell.error.loadState') }}</p>
      } @else if (desktop.transcript().length === 0) {
        <div class="invite">
          <span class="invite-icon"><svg lucideSlidersVertical [size]="26"></svg></span>
          <h1 class="invite-title">{{ i18n.t('chat.invite.heading') }}</h1>
          <p class="invite-text">{{ i18n.t('chat.invite.text') }}</p>
          <div class="chips">
            @for (chip of chips(); track chip) {
              <button class="chip" type="button" (click)="fillDraft(chip)">{{ chip }}</button>
            }
          </div>
        </div>
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
        @if (desktop.busy()) {
          <div class="row ai" aria-live="polite">
            <span class="who">{{ i18n.t('shell.chat.assistant') }}</span>
            <div class="prose status">
              <span class="status-dot thinking-dot"></span>{{ statusLabel() }}
            </div>
          </div>
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
      .invite {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;
        margin: auto;
        padding: 24px 12px;
      }
      .invite-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: var(--r-md);
        background: var(--accent-soft);
        color: var(--accent-strong);
      }
      .invite-title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 18px;
        color: var(--text);
      }
      .invite-text {
        margin: 0;
        max-width: 260px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-dim);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
        margin-top: 6px;
      }
      .chip {
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface-raised);
        color: var(--text-dim);
        font-family: var(--font-ui);
        font-size: 12.5px;
        cursor: pointer;
      }
      .chip:hover {
        border-color: var(--accent-line);
        color: var(--accent-strong);
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
      .row.ai {
        animation: message-in 180ms ease-out both;
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
      .status {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-dim);
        font-style: italic;
      }
      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: var(--accent);
      }
      .thinking-dot {
        animation: status-pulse 1.1s ease-in-out infinite;
      }
      @keyframes message-in {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes status-pulse {
        0%,
        100% {
          opacity: 0.3;
        }
        50% {
          opacity: 1;
        }
      }
    `,
  ],
})
export class ChatPane {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll')

  constructor() {
    effect(() => {
      this.desktop.transcript()
      this.desktop.busy()
      this.desktop.chatStatus()
      queueMicrotask(() => this.scrollToRecent())
    })
  }

  readonly chips = computed(() => [
    this.i18n.t('chat.invite.chip.metallica'),
    this.i18n.t('chat.invite.chip.jazz'),
    this.i18n.t('chat.invite.chip.fuzz'),
    this.i18n.t('chat.invite.chip.blues'),
  ])

  readonly memoryLost = () => this.desktop.currentConversation()?.memoryLost === true

  /** `chatStatus` starts null for the brief gap before the first phase push
   *  arrives, and `querying` is always that first phase — same fallback. */
  readonly statusLabel = computed(() => {
    const status = this.desktop.chatStatus() ?? 'querying'
    return this.i18n.t(`chat.status.${status}`)
  })

  /** A chip only fills the composer draft — the guitarist decides to send. */
  fillDraft(text: string): void {
    this.desktop.draft.set(text)
  }

  /** Orders stable; role is enough inside one conversation, indexed by position. */
  msgKey(index: number, role: string): string {
    return `${index}-${role}`
  }

  private scrollToRecent(): void {
    const element = this.scroll()?.nativeElement
    // The unit-test DOM (Angular's vitest runner) implements neither
    // scrollTo nor scrollBy — admitting the absent API here would throw
    // an uncaught TypeError on every effect run and fail the whole suite.
    if (element?.scrollTo) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }
}