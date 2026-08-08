/**
 * Operational status row: MIDI port, active AI model, and the transient chat
 * status pill. Reads `DesktopService` signals only (see `opentimbre-angular-ui`).
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { LucideLoaderCircle } from '@lucide/angular'
import { ChatStatus } from '@opentimbre/contracts'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-status-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideLoaderCircle],
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
        margin-left: auto;
        color: var(--accent);
      }
      .pill {
        color: var(--text-dim);
        white-space: nowrap;
      }
    `,
  ],
})
export class StatusBar {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

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
}