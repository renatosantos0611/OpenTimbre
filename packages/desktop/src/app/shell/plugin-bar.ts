/**
 * The plugin bar: shows only the plugin the AI suggested for the current
 * conversation (`OpenConversation.plugin`), rendering its status
 * (installed/running/mapping) and actions (open, install mapping). Empty
 * until the conversation has a suggestion. States arrive via
 * `plugin:changed` pushes into `DesktopService.pluginStates`.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject } from '@angular/core'
import { LucideAudioLines, LucideDownload, LucidePlay } from '@lucide/angular'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-plugin-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAudioLines, LucideDownload, LucidePlay],
  template: `
    <span class="label">{{ i18n.t('shell.plugin.title') }}</span>
    @if (pluginIds().length === 0) {
      <span class="empty">
        <svg lucideAudioLines [size]="14"></svg>
        {{ i18n.t('shell.plugin.empty') }}
      </span>
    } @else {
      <div class="plugins">
        @for (id of pluginIds(); track id) {
          @if (state(id); as p) {
            <div class="plugin" [attr.data-status]="p.mappingStatus">
              <span class="dot" [class.running]="p.running"></span>
              <span class="name">{{ p.name }}</span>
              <span class="meta">{{ metaLabel(p) }}</span>
              @if (p.installed) {
                <button
                  class="action"
                  type="button"
                  [attr.aria-label]="i18n.t('plugin.open', { name: p.name })"
                  [attr.title]="i18n.t('plugin.open', { name: p.name })"
                  (click)="desktop.openPlugin(id)"
                >
                  <svg lucidePlay [size]="13"></svg>
                </button>
              }
              @if (p.mappingStatus === 'missing' || p.mappingStatus === 'outdated') {
                <button
                  class="action"
                  type="button"
                  [attr.aria-label]="i18n.t('plugin.installMapping')"
                  [attr.title]="i18n.t('plugin.installMapping')"
                  (click)="desktop.installMapping(id)"
                >
                  <svg lucideDownload [size]="13"></svg>
                </button>
              }
            </div>
          }
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 34px;
        padding: 0 10px;
        background: var(--surface-chrome);
        border-bottom: 1px solid var(--border);
        font-size: 12px;
        overflow: hidden;
      }
      .label {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 9.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-faint);
        flex: none;
      }
      .empty {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--text-faint);
        white-space: nowrap;
      }
      .plugins {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        min-width: 0;
      }
      .plugin {
        display: flex;
        align-items: center;
        gap: 5px;
        flex: none;
        padding: 2px 6px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--text-faint);
      }
      .dot.running {
        background: var(--success);
      }
      .name {
        color: var(--text);
        font-weight: 500;
      }
      .meta {
        color: var(--text-faint);
        font-size: 11px;
      }
      .action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        padding: 0;
        border: 0;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text-dim);
        cursor: pointer;
      }
      .action:hover {
        background: var(--surface-raise);
        color: var(--text);
      }
    `,
  ],
})
export class PluginBar {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

  readonly pluginIds = computed(() => {
    const suggested = this.desktop.currentConversation()?.plugin
    return suggested ? [suggested] : []
  })

  /**
   * `pluginStates` is normally filled by the main process's boot-time poll
   * pushing `plugin:changed` — but that poll starts as soon as the window is
   * created, racing this app's own boot (Angular loading, `DesktopService`
   * subscribing). A plugin whose push arrives before the subscription is up
   * never gets re-sent (the poll only re-emits on a state change), so it
   * would stay unknown, and therefore invisible here, for the rest of the
   * session. Pull it directly the moment a conversation suggests a plugin
   * this bar hasn't seen a state for yet.
   */
  constructor() {
    const ref = effect(() => {
      for (const id of this.pluginIds()) {
        if (!this.desktop.pluginStates()[id]) void this.desktop.getPluginState(id)
      }
    })
    inject(DestroyRef).onDestroy(() => ref.destroy())
  }

  state(id: string) {
    return this.desktop.pluginStates()[id]
  }

  metaLabel(p: import('@opentimbre/contracts').PluginState): string {
    if (!p.installed) return this.i18n.t('plugin.notInstalled')
    if (p.running) return this.i18n.t('plugin.running')
    return this.i18n.t('plugin.stopped')
  }
}