/**
 * The always-mounted input outside the central pane, so its draft survives
 * pane switches. Layout follows the legacy: textarea and actions row (model
 * slot, Manual/Auto mode, send) share one bordered box that grows with the
 * text, hint line below it. Sends intent through `DesktopService` (see
 * `opentimbre-angular-ui`).
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core'
import { LucideSend } from '@lucide/angular'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'
import { ModeMenu } from './mode-menu'
import { ModelMenu } from './model-menu'

@Component({
  selector: 'ot-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideSend, ModeMenu, ModelMenu],
  template: `
    <div class="composer">
      <div class="composer-inner">
        <textarea
          #entry
          class="entry"
          rows="1"
          [placeholder]="i18n.t('shell.composer.placeholder')"
          [value]="draft()"
          (input)="onInput($event)"
          (keydown.enter)="onEnter($event)"
          [attr.aria-label]="i18n.t('shell.composer.placeholder')"
        ></textarea>

        <div class="actions">
          <ot-model-menu />
          <ot-mode-menu />
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
        </div>
      </div>

      <p class="hint">{{ i18n.t('chat.hint') }}</p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--surface-chrome);
        border-top: 1px solid var(--border);
      }
      .composer {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
      }
      .composer-inner {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        background: var(--surface-raised);
        padding: 10px 10px 8px;
        transition: border-color 0.12s ease;
      }
      .composer-inner:focus-within {
        border-color: var(--border-strong);
      }
      .entry {
        width: 100%;
        resize: none;
        max-height: 150px;
        padding: 0;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.4;
        box-sizing: border-box;
      }
      .entry::placeholder {
        color: var(--text-faint);
      }
      .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 8px;
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
      .hint {
        margin: 0;
        font-size: 11px;
        color: var(--text-faint);
        text-align: center;
      }
    `,
  ],
})
export class Composer {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

  private readonly entry = viewChild.required<ElementRef<HTMLTextAreaElement>>('entry')

  readonly draft = this.desktop.draft
  /** Disabled while empty or while a provider call is in flight. */
  readonly canSend = computed(() => this.draft().trim().length > 0 && !this.desktop.busy())

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement
    this.draft.set(el.value)
    this.resize(el)
  }

  send(): void {
    const text = this.draft().trim()
    if (!text || this.desktop.busy()) return
    this.draft.set('')
    void this.desktop.sendChat(text)
    const el = this.entry().nativeElement
    el.value = ''
    this.resize(el)
  }

  /** Grows/shrinks the textarea with its content, capped by `.entry`'s `max-height`. */
  private resize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  onEnter(event: Event): void {
    // Shift+Enter is a line break (the textarea's default); only plain Enter sends.
    if ((event as KeyboardEvent).shiftKey) return
    event.preventDefault()
    this.send()
  }
}