/**
 * The window's drag region: a single hamburger button that opens the anchored
 * app menu (Settings, About). The legacy keeps the app identity out of this
 * strip — a narrow bar repeating "OpenTimbre" wastes space the guitarist
 * already knows. Reads no state; emits which pane to open (see
 * `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, HostListener, inject, output, signal } from '@angular/core'
import { LucideInfo, LucideMenu, LucideSettings } from '@lucide/angular'
import type { Pane } from '../pane'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-titlebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideMenu, LucideInfo, LucideSettings],
  template: `
    <div class="bar">
      <button
        class="menu-btn"
        type="button"
        [attr.aria-expanded]="open()"
        [attr.aria-haspopup]="'menu'"
        [attr.aria-label]="i18n.t('shell.appMenu')"
        [attr.title]="i18n.t('shell.appMenu')"
        (click)="toggleMenu($event)"
      >
        <svg lucideMenu [size]="16"></svg>
      </button>
    </div>

    @if (open()) {
      <div class="menu" role="menu">
        <button class="menu-item" type="button" (click)="choose('settings')">
          <svg lucideSettings [size]="15"></svg>
          <span>{{ i18n.t('shell.menu.settings') }}</span>
        </button>
        <button class="menu-item" type="button" (click)="choose('about')">
          <svg lucideInfo [size]="15"></svg>
          <span>{{ i18n.t('shell.menu.about') }}</span>
        </button>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: relative;
        display: block;
        height: 40px;
        background: var(--surface-chrome);
        border-bottom: 1px solid var(--border);
        -webkit-app-region: drag;
        z-index: 20;
      }
      .bar {
        display: flex;
        align-items: center;
        height: 100%;
        padding: 0 10px;
      }
      .menu-btn {
        -webkit-app-region: no-drag;
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
      .menu-btn:hover,
      .menu-btn[aria-expanded='true'] {
        background: var(--surface-raise);
        color: var(--text);
      }
      .menu {
        position: absolute;
        top: 44px;
        left: 8px;
        min-width: 180px;
        padding: 4px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        box-shadow: var(--shadow);
        -webkit-app-region: no-drag;
      }
      .menu-item {
        display: flex;
        align-items: center;
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
      .menu-item:hover {
        background: var(--surface-raise);
      }
      .menu-item svg {
        color: var(--text-dim);
      }
    `,
  ],
})
export class TitleBar {
  readonly i18n = inject(I18nService)
  readonly open = signal(false)
  readonly select = output<Pane>()

  toggleMenu(event: Event): void {
    event.stopPropagation()
    this.open.update((v) => !v)
  }

  choose(paneId: Pane): void {
    this.open.set(false)
    this.select.emit(paneId)
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.open.set(false)
  }
}