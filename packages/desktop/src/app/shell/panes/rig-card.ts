/**
 * A scene card: the faceplate the apply button loads into the plugin, with an
 * expandable body ("how this tone was built") and a footer describing the hand.
 * One card per scene; the apply button forwards the scene id to
 * `DesktopService` and shows a transient "applied" confirmation
 * (see `opentimbre-plugin-spec`: the card renders only derived data, never a
 * CC value or plugin branch).
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { LucideChevronDown, LucidePlay } from '@lucide/angular'
import type { Cards, Rig } from '@opentimbre/contracts'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'

@Component({
  selector: 'ot-rig-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChevronDown, LucidePlay],
  template: `
    <article class="card">
      @for (scene of scenes(); track scene.id) {
        <header class="head">
          <div class="id">
            <h3 class="title">{{ scene.detail.title }}</h3>
            @if (scene.detail.summary) {
              <p class="summary">{{ scene.detail.summary }}</p>
            }
          </div>
          <button
            class="apply"
            type="button"
            [attr.aria-label]="i18n.t('chat.card.applyAria', { plugin: rig().plugin })"
            (click)="apply(scene.id)"
          >
            <svg lucidePlay [size]="14" />
            {{ applyingId() === scene.id ? i18n.t('chat.card.applied') : i18n.t('chat.card.apply') }}
          </button>
          <button
            class="expand"
            type="button"
            [attr.aria-expanded]="expanded()"
            [attr.aria-label]="i18n.t('chat.card.expandAria')"
            (click)="toggle()"
          >
            <svg lucideChevronDown [size]="16" />
          </button>
        </header>

        <div class="faceplate">
          @for (v of scene.card.values; track v.label) {
            <span class="fv"><b>{{ v.label }}</b><i>{{ v.value }}</i></span>
          }
        </div>

        @if (scene.card.pedals.length > 0) {
          <div class="pedals">
            @for (p of scene.card.pedals; track p.name) {
              <span class="pedal">
                <span class="led"></span>
                <b>{{ p.name }}</b>
                @if (p.detail) {
                  <i>{{ p.detail }}</i>
                }
              </span>
            }
          </div>
        }

        @if (expanded()) {
          <p class="why">{{ scene.detail.explanation }}</p>
          <footer class="foot">
            <span class="foot-item">
              {{ i18n.t('chat.card.pickups', { pickup: scene.detail.guitar.pickupPosition }) }}
            </span>
            <span class="foot-item">{{ scene.detail.guitar.technique }}</span>
          </footer>
        }
      }
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .card {
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        background: var(--surface-raised);
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
      }
      .id {
        flex: 1;
        min-width: 0;
      }
      .title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
      }
      .summary {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--text-dim);
      }
      .apply {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        flex: none;
        padding: 6px 9px;
        border: 0;
        border-radius: var(--r-sm);
        background: var(--accent);
        color: var(--accent-ink);
        font-family: var(--font-ui);
        font-size: 12px;
        cursor: pointer;
      }
      .apply:hover {
        background: var(--accent-strong);
      }
      .expand {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        flex: none;
        padding: 0;
        border: 0;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text-dim);
        cursor: pointer;
      }
      .expand:hover {
        background: var(--surface-raise);
        color: var(--text);
      }
      .faceplate {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        padding: 8px 12px;
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        background: var(--surface);
      }
      .fv {
        display: inline-flex;
        gap: 4px;
        font-size: 12px;
      }
      .fv b {
        color: var(--text-dim);
        font-weight: 500;
      }
      .fv i {
        color: var(--text);
      }
      .pedals {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
        padding: 8px 12px;
      }
      .pedal {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
      }
      .pedal b {
        color: var(--text);
        font-weight: 500;
      }
      .pedal i {
        color: var(--text-dim);
      }
      .led {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--warning);
      }
      .why {
        margin: 0;
        padding: 10px 12px;
        font-size: 13px;
        color: var(--text-dim);
      }
      .foot {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        padding: 8px 12px;
        border-top: 1px solid var(--border);
        font-size: 12px;
        color: var(--text-faint);
      }
    `,
  ],
})
export class RigCard {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)

  readonly rig = input.required<Rig>()
  readonly cards = input<Cards | null>(null)

  readonly expanded = signal(false)
  readonly applyingId = signal<string | null>(null)

  readonly scenes = computed(() =>
    Object.entries(this.rig().scenes).map(([id, detail]) => ({
      id,
      detail,
      card: this.cards()?.[id] ?? { values: [], pedals: [] },
    })),
  )

  toggle(): void {
    this.expanded.update((v) => !v)
  }

  async apply(scene: string): Promise<void> {
    const result = await this.desktop.applyRig(scene)
    if (!result) return
    this.applyingId.set(scene)
    setTimeout(() => this.applyingId.set(null), 1600)
  }
}