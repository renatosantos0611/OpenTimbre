/**
 * Root shell: title bar, operational status, plugin bar, central pane, and
 * composer. Owns the active-pane signal and the theme/dim attributes on the
 * host; the panes stay mounted (toggled by class) so chat content, draft, and
 * scroll survive a switch — there is no router (see `opentimbre-angular-ui`).
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'
import { PANES, type Pane } from '../pane'
import { TitleBar } from './titlebar'
import { StatusBar } from './status-bar'
import { PluginBar } from './plugin-bar'
import { Composer } from './composer'
import { ChatPane } from './panes/chat-pane'
import { HistoryPane } from './panes/history-pane'
import { SettingsPane } from './panes/settings-pane'

@Component({
  selector: 'ot-app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitleBar, StatusBar, PluginBar, Composer, ChatPane, HistoryPane, SettingsPane],
  template: `
    <div class="shell" [attr.data-dimmed]="dimmed() ? 'true' : null">
      <ot-titlebar />
      <ot-status-bar />
      <ot-plugin-bar />

      <section class="central">
        <nav class="pane-tabs" role="tablist" [attr.aria-label]="i18n.t('shell.appName')">
          @for (paneId of PANES; track paneId) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="paneId === pane()"
              [class.is-active]="paneId === pane()"
              (click)="selectPane(paneId)"
            >
              {{ paneLabel()[paneId] }}
            </button>
          }
        </nav>

        <div class="panes">
          <div class="pane" [class.is-active]="pane() === 'chat'">
            <ot-chat-pane />
          </div>
          <div class="pane" [class.is-active]="pane() === 'history'">
            <ot-history-pane />
          </div>
          <div class="pane" [class.is-active]="pane() === 'settings'">
            <ot-settings-pane />
          </div>
        </div>
      </section>

      <ot-composer />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .shell {
        display: grid;
        grid-template-rows: auto auto auto 1fr auto;
        height: 100vh;
        background: var(--surface);
        color: var(--text);
        transition: opacity 120ms ease;
      }
      .shell[data-dimmed='true'] {
        opacity: 0.55;
      }
      .central {
        display: flex;
        flex-direction: column;
        min-height: 0;
        border-top: 1px solid var(--border);
      }
      .pane-tabs {
        display: flex;
        gap: 4px;
        padding: 8px 10px 0;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        flex: none;
      }
      .pane-tabs button {
        flex: 1;
        padding: 6px 0;
        border: 0;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: var(--text-dim);
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 12px;
        letter-spacing: 0.02em;
        cursor: pointer;
      }
      .pane-tabs button:hover {
        color: var(--text);
      }
      .pane-tabs button.is-active {
        color: var(--accent-strong);
        border-bottom-color: var(--accent);
      }
      .panes {
        flex: 1;
        min-height: 0;
        position: relative;
      }
      .pane {
        position: absolute;
        inset: 0;
        display: none;
      }
      .pane.is-active {
        display: flex;
      }
    `,
  ],
})
export class AppShell implements OnInit {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
  readonly PANES = PANES

  readonly pane = signal<Pane>('chat')
  private readonly focused = signal(true)

  readonly dimmed = computed(() => this.desktop.dimOnUnfocus() && !this.focused())

  readonly paneLabel = computed(
    () =>
      ({
        chat: this.i18n.t('shell.pane.chat'),
        history: this.i18n.t('shell.pane.history'),
        settings: this.i18n.t('shell.pane.settings'),
      }) as Record<Pane, string>,
  )

  /**
   * The theme tokens hang off `:root[data-theme]`, so the resolved theme is
   * written to the document element, not the component host. An `effect` keeps
   * it in step with the resolved theme (including the `window:themeChanged`
   * push). The effect is created in the constructor and passed to
   * `DestroyRef`, both to tear it down and to keep the minifier from dropping
   * it — an unused private field initializer is tree-shaken out of the build.
   */
  constructor() {
    const ref = effect(() => {
      document.documentElement.dataset.theme = this.desktop.resolvedTheme()
    })
    inject(DestroyRef).onDestroy(() => ref.destroy())
  }

  ngOnInit(): void {
    this.desktop.load()
    this.focused.set(document.hasFocus())
  }

  @HostListener('window:focus')
  onFocus(): void {
    this.focused.set(true)
  }

  @HostListener('window:blur')
  onBlur(): void {
    this.focused.set(false)
  }

  selectPane(paneId: Pane): void {
    this.pane.set(paneId)
  }
}