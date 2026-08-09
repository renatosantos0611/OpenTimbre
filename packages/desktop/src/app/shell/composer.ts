/**
 * The always-mounted input row outside the central pane, so its draft survives
 * pane switches. Sends intent through `DesktopService`; the chat transcript
 * that responds is Task 9-10.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core'
import { LucidePlus, LucideSend } from '@lucide/angular'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucidePlus, LucideSend],
  template: `
    <textarea
      class="entry"
      rows="1"
      [placeholder]="i18n.t('shell.composer.placeholder')"
      [value]="draft()"
      (input)="onInput($event)"
      (keydown.enter)="onEnter($event)"
      [attr.aria-label]="i18n.t('shell.composer.placeholder')"
    ></textarea>
    <button
      class="new"
      type="button"
      [attr.aria-label]="i18n.t('shell.composer.new')"
      [attr.title]="i18n.t('shell.composer.new')"
      (click)="newChat()"
    >
      <svg lucidePlus [size]="16"></svg>
    </button>
    <button
      class="send"
      type="button"
      [disabled]="!canSend()"
      [attr.aria-label]="i18n.t('shell.composer.send')"
      [attr.title]="i18n.t('shell.composer.send')"
      (click)="send()"
    >
      <svg lucideSend [size]="16"></svg>
    </button>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 10px;
        background: var(--surface-chrome);
        border-top: 1px solid var(--border);
      }
      .entry {
        flex: 1;
        min-width: 0;
        resize: none;
        max-height: 96px;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        background: var(--surface-raised);
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.4;
      }
      .entry::placeholder {
        color: var(--text-faint);
      }
      .send {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        flex: none;
        border: 0;
        border-radius: var(--r-md);
        background: var(--accent);
        color: var(--accent-ink);
        cursor: pointer;
      }
      .send:hover:not(:disabled) {
        background: var(--accent-strong);
      }
      .send:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .new {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        flex: none;
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        background: var(--surface-raised);
        color: var(--text-dim);
        cursor: pointer;
      }
      .new:hover {
        border-color: var(--border-strong);
        color: var(--text);
      }
    `,
  ],
})
export class Composer {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

  readonly draft = this.desktop.draft
  /** Disabled while empty or while a provider call is in flight. */
  readonly canSend = computed(() => this.draft().trim().length > 0 && !this.desktop.busy())

  onInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value)
  }

  send(): void {
    const text = this.draft().trim()
    if (!text || this.desktop.busy()) return
    this.draft.set('')
    void this.desktop.sendChat(text)
  }

  newChat(): void {
    this.draft.set('')
    void this.desktop.newChat()
  }

  onEnter(event: Event): void {
    event.preventDefault()
    this.send()
  }
}