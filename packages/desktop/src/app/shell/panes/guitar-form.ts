/**
 * Guitar settings: model, pickups, tuning, and string count. Reads the
 * current `Guitar` from `DesktopService` and forwards the edited object on
 * save. The form only emits intent; the persisted value round-trips through
 * the service. Pickup options are derived data, not a domain rule
 * (see `opentimbre-plugin-spec`).
 */
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'

const PICKUPS = ['single', 'humbucker', 'HSS', 'HSH', 'P90', 'other'] as const

@Component({
  selector: 'ot-guitar-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      <label class="field">
        <span>{{ i18n.t('settings.guitar.model') }}</span>
        <input [value]="model()" (input)="model.set($any($event.target).value)" />
      </label>
      <label class="field">
        <span>{{ i18n.t('settings.guitar.pickups') }}</span>
        <select [value]="pickups()" (change)="pickups.set($any($event.target).value)">
          @for (p of PICKUPS; track p) {
            <option [value]="p">{{ pickupLabel(p) }}</option>
          }
        </select>
      </label>
      <label class="field">
        <span>{{ i18n.t('settings.guitar.tuning') }}</span>
        <input [value]="tuning()" (input)="tuning.set($any($event.target).value)" />
      </label>
      <label class="field">
        <span>{{ i18n.t('settings.guitar.strings') }}</span>
        <input type="number" min="4" max="12" [value]="strings()" (input)="setStrings($any($event.target).value)" />
      </label>
    </div>
    <button class="save" type="button" (click)="save()">
      {{ saved() ? i18n.t('settings.guitar.saved') : i18n.t('settings.guitar.save') }}
    </button>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-size: 12px;
        color: var(--text-dim);
      }
      .field input,
      .field select {
        padding: 6px 8px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 13px;
      }
      .save {
        margin-top: 8px;
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 12px;
        cursor: pointer;
      }
      .save:hover {
        border-color: var(--border-strong);
      }
    `,
  ],
})
export class GuitarForm {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
  readonly PICKUPS = PICKUPS

  readonly model = signal('')
  readonly pickups = signal('humbucker')
  readonly tuning = signal('')
  readonly strings = signal(6)
  readonly saved = signal(false)

  constructor() {
    // Populate the form when the persisted guitar arrives (load() is async),
    // without clobbering a value the user is editing.
    effect(() => {
      const g = this.desktop.guitar()
      if (!g || this.model()) return
      this.model.set(g.model)
      this.pickups.set(g.pickups)
      this.tuning.set(g.tuning)
      this.strings.set(g.strings)
    })
  }

  async save(): Promise<void> {
    await this.desktop.setGuitar({
      model: this.model().trim() || 'Custom',
      pickups: (this.pickups() as (typeof PICKUPS)[number]) ?? 'humbucker',
      tuning: this.tuning().trim() || 'E standard',
      strings: this.strings(),
    })
    this.saved.set(true)
    setTimeout(() => this.saved.set(false), 1600)
  }

  setStrings(value: string): void {
    this.strings.set(Number(value))
  }

  pickupLabel(p: (typeof PICKUPS)[number]): string {
    const key = `settings.guitar.pickup.${p}` as const
    return this.i18n.t(key)
  }
}