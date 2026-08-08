/**
 * The chat transcript pane. Conversation bubbles and cards land here in
 * Tasks 9-10; for now it shows the empty or loading state and the currently
 * open conversation's title. It stays mounted across pane switches so its
 * scroll position survives (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'

@Component({
  selector: 'ot-chat-pane',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scroll">
      @if (!desktop.ready()) {
        <p class="empty">{{ i18n.t('shell.empty.loading') }}</p>
      } @else if (desktop.loadError()) {
        <p class="empty error">{{ i18n.t('shell.error.loadState') }}</p>
      } @else if (desktop.currentConversation()) {
        <h1 class="title">{{ desktop.currentConversation()?.title }}</h1>
        <p class="empty">{{ i18n.t('shell.empty.chat') }}</p>
      } @else {
        <p class="empty">{{ i18n.t('shell.empty.chat') }}</p>
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
      }
      .title {
        margin: 0 0 8px;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 18px;
        color: var(--text);
      }
      .empty {
        margin: 0;
        color: var(--text-dim);
      }
      .empty.error {
        color: var(--danger);
      }
    `,
  ],
})
export class ChatPane {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
}