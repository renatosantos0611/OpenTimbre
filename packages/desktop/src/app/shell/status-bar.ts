/**
 * Operational status row: MIDI port, active AI model, the transient chat
 * status pill, the update banner (confirm -> progress -> restart), which is
 * one extra right-aligned row driven by the `updater:status` push, and the
 * three chrome actions (history, new conversation, settings). Reads
 * `DesktopService` signals and emits intent (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core'
import { LucideHistory, LucideLoaderCircle, LucidePlus, LucideSettings } from '@lucide/angular'
import { ChatStatus, UpdaterStatus } from '@opentimbre/contracts'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-status-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideLoaderCircle, LucideHistory, LucidePlus, LucideSettings],
  template: `
    <div class="row">
      <span class="label">{{ i18n.t('shell.status.midi') }}</span>
      <span class="value" [class.muted]="!port()">
        @if (midiError()) {
          <span class="dot danger"></span>{{ i18n.t('shell.status.midiError') }}
        } @else if (port()) {
          {{ i18n.t('shell.status.midiOpen', { port: port() ?? '' }) }}
        } @else {
          <span class="dot muted"></span>{{ i18n.t('shell.status.midiClosed') }}
        }
      </span>
    </div>
    <div class="row">
      <span class="label">{{ i18n.t('shell.status.ai') }}</span>
      <span class="value" [class.muted]="!aiModel()">
        @if (aiModel()) {
          {{ aiModel() }}
        } @else {
          <span class="dot muted"></span>{{ i18n.t('shell.status.noAi') }}
        }
      </span>
    </div>
    @if (chatStatusLabel()) {
      <div class="row pill-row">
        <svg lucideLoaderCircle [size]="14"></svg>
        <span class="pill">{{ chatStatusLabel() }}</span>
      </div>
    }
    @if (update(); as upd) {
      <div class="row update" [attr.data-state]="upd.state">
        @switch (upd.state) {
          @case ('available') {
            <span class="value">{{ i18n.t('shell.update.available', { version: upd.version }) }}</span>
            <button class="action confirm" type="button" (click)="desktop.downloadUpdate()">
              {{ i18n.t('shell.update.download') }}
            </button>
            <button class="action dismiss" type="button" (click)="desktop.dismissUpdate()">
              {{ i18n.t('shell.update.dismiss') }}
            </button>
          }
          @case ('downloading') {
            <span class="value">{{ i18n.t('shell.update.downloading', { percent: percentLabel(upd) }) }}</span>
          }
          @case ('ready') {
            <span class="value accent">{{ i18n.t('shell.update.ready') }}</span>
            <button class="action confirm" type="button" (click)="desktop.installUpdate()">
              {{ i18n.t('shell.update.restart') }}
            </button>
          }
          @case ('error') {
            <span class="dot danger"></span>
            <span class="value">{{ i18n.t('shell.update.error') }}</span>
            <span class="value detail">{{ upd.message }}</span>
            <button class="action confirm" type="button" (click)="desktop.downloadUpdate()">
              {{ i18n.t('shell.update.retry') }}
            </button>
            <button class="action dismiss" type="button" (click)="desktop.dismissUpdate()">
              {{ i18n.t('shell.update.dismiss') }}
            </button>
          }
        }
      </div>
    }
    <div class="row actions">
      <button
        class="icon"
        type="button"
        [attr.aria-label]="i18n.t('shell.status.history')"
        [attr.title]="i18n.t('shell.status.history')"
        (click)="openHistory.emit()"
      >
        <svg lucideHistory [size]="15"></svg>
      </button>
      <button
        class="icon"
        type="button"
        [attr.aria-label]="i18n.t('shell.status.newChat')"
        [attr.title]="i18n.t('shell.status.newChat')"
        (click)="newChat.emit()"
      >
        <svg lucidePlus [size]="15"></svg>
      </button>
      <button
        class="icon"
        type="button"
        [attr.aria-label]="i18n.t('shell.status.settings')"
        [attr.title]="i18n.t('shell.status.settings')"
        (click)="openSettings.emit()"
      >
        <svg lucideSettings [size]="15"></svg>
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        gap: 14px;
        height: 34px;
        padding: 0 10px;
        background: var(--surface-chrome);
        border-bottom: 1px solid var(--border);
        font-size: 12px;
        overflow: hidden;
      }
      .row {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .label {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 9.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-faint);
      }
      .value {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--text-dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .value.muted {
        color: var(--text-faint);
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex: none;
      }
      .dot.muted {
        background: var(--text-faint);
      }
      .dot.danger {
        background: var(--danger);
      }
      .pill-row {
        color: var(--accent);
      }
      .pill {
        color: var(--text-dim);
        white-space: nowrap;
      }
      .update {
        min-width: 0;
        overflow: hidden;
      }
      .update .value {
        flex: none;
        min-width: 0;
      }
      .update .value.accent {
        color: var(--accent-strong);
      }
      .update .value.detail {
        flex: 0 1 auto;
        color: var(--text-faint);
      }
      .update .action {
        flex: none;
        padding: 2px 10px;
        border: 0;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--accent);
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 11px;
        letter-spacing: 0.06em;
        cursor: pointer;
      }
      .update .action:hover {
        background: var(--accent-soft);
      }
      .update .action.dismiss {
        color: var(--text-faint);
      }
      .update .action.dismiss:hover {
        color: var(--text-dim);
      }
      .actions {
        margin-left: auto;
        gap: 2px;
      }
      .icon {
        -webkit-app-region: no-drag;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 0;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text-dim);
        cursor: pointer;
      }
      .icon:hover {
        background: var(--surface-raise);
        color: var(--text);
      }
    `,
  ],
})
export class StatusBar {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

  readonly openHistory = output<void>()
  readonly newChat = output<void>()
  readonly openSettings = output<void>()

  readonly port = computed(() => this.desktop.midi().port)
  readonly midiError = computed(() => this.desktop.midi().error)
  readonly aiModel = computed(() => this.desktop.ai()?.model ?? '')

  readonly chatStatusLabel = computed(() => {
    const status: ChatStatus = this.desktop.chatStatus()
    if (status === 'querying') return this.i18n.t('chat.status.querying')
    if (status === 'validating') return this.i18n.t('chat.status.validating')
    if (status === 'correcting') return this.i18n.t('chat.status.correcting')
    return null
  })

  /** The banner content, or nothing while dismissed for the session. */
  readonly update = computed(() => (this.desktop.updaterDismissed() ? null : this.desktop.updaterStatus()))

  /** electron-updater reports fractional percents; the banner shows whole numbers. */
  percentLabel(status: UpdaterStatus): string {
    return status.state === 'downloading' ? String(Math.round(status.percent)) : ''
  }
}
