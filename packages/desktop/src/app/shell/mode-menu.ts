/**
 * The Manual/Auto application-mode selector. The composer sits at the bottom
 * of a 700px window, so the menu opens upward. The mode is a single source of
 * truth in `DesktopService.autoApply()` — this component only reads it and
 * emits the choice; it does not hold a second copy (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core'
import { LucideChevronUp, LucidePencil, LucideZap } from '@lucide/angular'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-mode-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucidePencil, LucideZap, LucideChevronUp],
  template: `
    <div class="wrap">
      <button
        class="mode-btn"
        type="button"
        [attr.aria-expanded]="open()"
        [attr.aria-haspopup]="'menu'"
        [attr.title]="i18n.t('chat.mode.title')"
        (click)="toggle($event)"
      >
        @if (autoApply()) {
          <svg lucideZap [size]="14"></svg>
        } @else {
          <svg lucidePencil [size]="14"></svg>
        }
        <span>{{ label() }}</span>
        <svg lucideChevronUp [size]="14"></svg>
      </button>

      @if (open()) {
        <div class="menu" role="menu" [attr.aria-label]="i18n.t('chat.mode.title')">
          <button class="option" type="button" [attr.aria-pressed]="!autoApply()" (click)="choose(false)">
            <svg lucidePencil [size]="15"></svg>
            <span class="opt-text">
              <b>{{ i18n.t('chat.mode.manual') }}</b>
              <em>{{ i18n.t('chat.mode.manualDesc') }}</em>
            </span>
          </button>
          <button class="option" type="button" [attr.aria-pressed]="autoApply()" (click)="choose(true)">
            <svg lucideZap [size]="15"></svg>
            <span class="opt-text">
              <b>{{ i18n.t('chat.mode.auto') }}</b>
              <em>{{ i18n.t('chat.mode.autoDesc') }}</em>
            </span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }
      .mode-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 10px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text-dim);
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
      }
      .mode-btn:hover,
      .mode-btn[aria-expanded='true'] {
        border-color: var(--accent-line);
        color: var(--text);
      }
      .menu {
        position: absolute;
        bottom: calc(100% + 6px);
        right: 0;
        width: 240px;
        padding: 4px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-popover);
        box-shadow: var(--shadow-pop);
        z-index: 30;
      }
      .option {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border: 0;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 13px;
        text-align: left;
        cursor: pointer;
      }
      .option:hover {
        background: var(--surface-raise);
      }
      .option[aria-pressed='true'] {
        color: var(--accent-strong);
      }
      .option svg {
        flex: none;
        margin-top: 2px;
        color: var(--text-dim);
      }
      .opt-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .opt-text b {
        font-weight: 600;
      }
      .opt-text em {
        font-style: normal;
        font-size: 12px;
        color: var(--text-dim);
        line-height: 1.4;
      }
    `,
  ],
})
export class ModeMenu {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
  readonly open = signal(false)

  readonly autoApply = this.desktop.autoApply
  readonly label = computed(() => (this.autoApply() ? this.i18n.t('chat.mode.auto') : this.i18n.t('chat.mode.manual')))

  toggle(event: Event): void {
    event.stopPropagation()
    this.open.update((v) => !v)
  }

  choose(auto: boolean): void {
    this.open.set(false)
    void this.desktop.setAutoApply(auto)
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.open.set(false)
  }
}