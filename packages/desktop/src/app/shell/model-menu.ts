/**
 * The model picker in the composer. The button shows the active model's label;
 * opening it reveals a searchable list grouped by cost tier, anchored upward
 * and to the left (the button sits at the bottom-left of the actions row). A
 * selection writes through the existing `setModel` setting, so the label
 * survives a restart. Degraded states (no key, empty, provider error) render
 * an explanatory line instead of an empty panel (see `opentimbre-angular-ui`).
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core'
import type { ModelInfo, ModelTier } from '@opentimbre/contracts'
import { LucideBrainCircuit, LucideChevronUp, LucideSearch } from '@lucide/angular'
import { DesktopService } from '../desktop.service'
import { I18nService } from '../i18n.service'

@Component({
  selector: 'ot-model-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideBrainCircuit, LucideChevronUp, LucideSearch],
  template: `
    <div class="wrap">
      <button
        class="model-btn"
        type="button"
        [attr.aria-expanded]="open()"
        [attr.aria-haspopup]="'menu'"
        [attr.title]="i18n.t('chat.model.title')"
        (click)="toggle($event)"
      >
        <svg class="ai-icon" lucideBrainCircuit [size]="14"></svg>
        <span class="label">{{ activeLabel() }}</span>
        <svg class="chev" lucideChevronUp [size]="14"></svg>
      </button>

      @if (open()) {
        <div class="panel" role="menu" [attr.aria-label]="i18n.t('chat.model.title')">
          <label class="search">
            <svg lucideSearch [size]="14"></svg>
            <input
              #searchInput
              type="text"
              [placeholder]="i18n.t('chat.model.search')"
              [value]="filter()"
              (input)="filter.set($any($event.target).value)"
              autocomplete="off"
            />
          </label>

          <div class="list">
            @if (desktop.modelsError()) {
              <p class="degraded">{{ i18n.t('chat.model.error') }}</p>
            } @else if (desktop.models().length === 0) {
              <p class="degraded">{{ i18n.t('chat.model.empty') }}</p>
            } @else if (filtered().length === 0) {
              <p class="degraded">{{ i18n.t('chat.model.noResults') }}</p>
            } @else {
              @for (group of groups(); track group.tier) {
                <div class="group">
                  <span class="group-tag">{{ tierLabel()[group.tier] }}</span>
                  @for (model of group.models; track model.id) {
                    <button
                      class="item"
                      type="button"
                      [attr.aria-pressed]="isActive(model)"
                      (click)="choose(model)"
                    >
                      <span class="item-name">{{ model.label }}</span>
                      <span class="item-id">{{ model.id }}</span>
                    </button>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        margin-right: auto;
      }
      .model-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 36px;
        width: 160px;
        padding: 0 8px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text-dim);
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
      }
      .model-btn:hover,
      .model-btn[aria-expanded='true'] {
        border-color: var(--accent-line);
        color: var(--text);
      }
      .ai-icon {
        flex: none;
        color: var(--text-faint);
      }
      .label {
        flex: 1;
        min-width: 0;
        /* A <button>'s UA default is text-align: center; override it. */
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .chev {
        flex: none;
      }
      .panel {
        position: absolute;
        /* The button sits at the bottom-left of the actions row; the menu opens
           upward and anchors to the same left edge. */
        bottom: calc(100% + 6px);
        left: 0;
        width: 240px;
        height: 320px;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        box-shadow: var(--shadow);
        z-index: 30;
        overflow: hidden;
      }
      .search {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px;
        border-bottom: 1px solid var(--border);
        color: var(--text-faint);
        flex: none;
      }
      .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        background: transparent;
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 13px;
        outline: 0;
      }
      .search input::placeholder {
        color: var(--text-faint);
      }
      .degraded {
        margin: 0;
        padding: 12px;
        font-size: 12.5px;
        color: var(--text-dim);
      }
      .group {
        padding: 4px;
      }
      .group-tag {
        display: block;
        padding: 4px 8px;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 9.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-faint);
      }
      .item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1px;
        width: 100%;
        padding: 6px 8px;
        border: 0;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 13px;
        text-align: left;
        cursor: pointer;
      }
      .item:hover {
        background: var(--surface-raise);
      }
      .item[aria-pressed='true'] {
        color: var(--accent-strong);
      }
      .item-id {
        font-size: 11px;
        color: var(--text-faint);
      }
    `,
  ],
})
export class ModelMenu implements OnInit {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
  private readonly elRef = inject(ElementRef)
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput')
  readonly open = signal(false)
  readonly filter = signal('')

  /**
   * Opening the panel jumps straight to search — no click detour before
   * typing. Created in the constructor and passed to `DestroyRef`, both to
   * tear it down and to keep the minifier from dropping it (see `AppShell`'s
   * theme effect for the same pattern).
   */
  constructor() {
    const ref = effect(() => {
      if (this.open()) this.searchInput()?.nativeElement.focus()
    })
    inject(DestroyRef).onDestroy(() => ref.destroy())
  }

  readonly tierLabel = computed(
    () =>
      ({
        low: this.i18n.t('chat.model.tier.low'),
        mid: this.i18n.t('chat.model.tier.mid'),
        high: this.i18n.t('chat.model.tier.high'),
      }) as Record<ModelTier, string>,
  )

  readonly activeLabel = computed(() => {
    const ai = this.desktop.ai()
    return ai ? ai.modelLabel : this.i18n.t('chat.model.none')
  })

  readonly filtered = computed(() => {
    const term = this.filter().trim().toLowerCase()
    return this.desktop.models().filter((m) => !term || m.id.toLowerCase().includes(term))
  })

  readonly groups = computed(() => {
    const tiers: ModelTier[] = ['low', 'mid', 'high']
    return tiers
      .map((tier) => ({ tier, models: this.filtered().filter((m) => m.tier === tier) }))
      .filter((g) => g.models.length > 0)
  })

  ngOnInit(): void {
    if (this.desktop.models().length === 0) void this.desktop.listModels()
  }

  isActive(model: ModelInfo): boolean {
    return model.id === this.desktop.ai()?.model
  }

  toggle(event: Event): void {
    event.stopPropagation()
    this.open.update((v) => !v)
  }

  choose(model: ModelInfo): void {
    this.open.set(false)
    void this.desktop.setModel(model.provider, model.id)
  }

  @HostListener('document:click', ['$event'])
  closeMenu(event: MouseEvent): void {
    // A click inside the picker (e.g. the search input) must not close it.
    if (!this.elRef.nativeElement.contains(event.target)) this.open.set(false)
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false)
  }
}