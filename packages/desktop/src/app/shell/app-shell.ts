/**
 * Root shell: title bar, operational status, plugin bar, central pane, and
 * composer. Owns the active-pane signal and the theme attribute on the host;
 * the panes stay mounted (toggled by class) so chat content, draft, and
 * scroll survive a switch — there is no router (see `opentimbre-angular-ui`).
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core'
import { DesktopService } from '../desktop.service'
import type { Pane } from '../pane'
import { TitleBar } from './titlebar'
import { StatusBar } from './status-bar'
import { PluginBar } from './plugin-bar'
import { Composer } from './composer'
import { ChatPane } from './panes/chat-pane'
import { HistoryPane } from './panes/history-pane'
import { SettingsPane } from './panes/settings-pane'
import { AboutPane } from './panes/about-pane'

@Component({
  selector: 'ot-app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitleBar, StatusBar, PluginBar, Composer, ChatPane, HistoryPane, SettingsPane, AboutPane],
  template: `
    <div class="shell">
      <ot-titlebar (select)="selectPane($event)" />
      <ot-status-bar
        (openHistory)="selectPane('history')"
        (openSettings)="selectPane('settings')"
        (newChat)="desktop.newChat()"
      />
      <ot-plugin-bar />

      <section class="central">
        <div class="panes">
          <div class="pane" [class.is-active]="pane() === 'chat'">
            <ot-chat-pane />
          </div>
          <div class="pane" [class.is-active]="pane() === 'history'">
            <ot-history-pane (back)="selectPane('chat')" (opened)="selectPane('chat')" />
          </div>
          <div class="pane" [class.is-active]="pane() === 'settings'">
            <ot-settings-pane (back)="selectPane('chat')" />
          </div>
          <div class="pane" [class.is-active]="pane() === 'about'">
            <ot-about-pane (back)="selectPane('chat')" />
          </div>
        </div>
      </section>

      @if (pane() === 'chat') {
        <ot-composer />
      }
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
      }
      .central {
        display: flex;
        flex-direction: column;
        min-height: 0;
        border-top: 1px solid var(--border);
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
        /* column, not the flex default (row): every pane's host sets its own
           height: 100% and relies on the cross axis to stretch its WIDTH to
           fill the window — a row container only auto-stretches height, so a
           centered pane like About was hugging its own content width instead
           of the full column. */
        flex-direction: column;
      }
      .pane.is-active {
        display: flex;
      }
    `,
  ],
})
export class AppShell implements OnInit {
  readonly desktop = inject(DesktopService)

  readonly pane = signal<Pane>('chat')

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
  }

  selectPane(paneId: Pane): void {
    this.pane.set(paneId)
  }
}