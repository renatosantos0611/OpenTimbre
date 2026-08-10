/**
 * AI settings: provider preference, model, and per-provider API keys. The
 * provider preference is a segmented Auto/Anthropic/OpenAI choice; when
 * `AI_PROVIDER` is set in the environment the controls are disabled with a
 * localized explanation. Key rows show only `KeyInfo` — a hint and flags,
 * never a plaintext key — and a save clears the input immediately
 * (see `opentimbre-secrets`).
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import type { ProviderPreference } from '@opentimbre/contracts'
import { DesktopService } from '../../desktop.service'
import { I18nService } from '../../i18n.service'

const PROVIDERS: { id: 'anthropic' | 'openai'; env: string }[] = [
  { id: 'openai', env: 'OPENAI_API_KEY' },
  { id: 'anthropic', env: 'ANTHROPIC_API_KEY' },
]

type KeyDraft = { provider: 'anthropic' | 'openai'; value: string }
type KeySource = 'app' | 'environment' | 'none'

@Component({
  selector: 'ot-ai-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (forced()) {
      <p class="hint warning">{{ i18n.t('settings.ai.forced', { env: 'AI_PROVIDER' }) }}</p>
    }

    <label class="field">
      <span>{{ i18n.t('settings.ai.provider') }}</span>
      <div class="seg" role="group" [attr.aria-label]="i18n.t('settings.ai.provider')">
        @for (pref of prefs; track pref) {
          <button
            class="seg-btn"
            type="button"
            [disabled]="locked()"
            [attr.aria-pressed]="pref === desktop.providerPreference()"
            (click)="setPreference(pref)"
          >
            {{ prefLabel()[pref] }}
          </button>
        }
      </div>
    </label>

    @if (!desktop.ai() && !forced()) {
      <p class="hint">{{ i18n.t('settings.ai.noProvider') }}</p>
    }

    @if (desktop.keysError()) {
      <p class="hint warning">{{ desktop.keysError() }}</p>
    }
    @for (k of keys(); track k.provider) {
      <div class="key-row" [class.unreadable]="!k.readable">
        <span class="badge" [attr.data-state]="k.source">{{ badgeLabel(k) }}</span>
        <span class="key-name">{{ k.label }}</span>
        @if (!k.readable) {
          <span class="key-hint warn">{{ i18n.t('settings.keys.unreadable') }}</span>
        } @else if (k.source === 'app' && !k.protected) {
          <span class="key-hint warn">{{ i18n.t('settings.keys.unencrypted') }}</span>
        }
        @if (k.source === 'app') {
          <button
            class="remove"
            type="button"
            [attr.aria-label]="i18n.t('settings.keys.remove', { label: k.label })"
            (click)="saveKeyForm(k.provider)"
          >
            {{ i18n.t('settings.keys.removeTitle') }}
          </button>
        }
      </div>
    }

    @for (p of PROVIDERS; track p.id) {
      <div class="key-add">
        <input
          type="password"
          autocomplete="off"
          [placeholder]="i18n.t('settings.keys.paste')"
          [value]="draft(p.id).value"
          (input)="setDraft(p.id, $any($event.target).value)"
          [attr.aria-label]="i18n.t('settings.keys.paste')"
        />
        <button class="save" type="button" (click)="saveDraft(p.id)">{{ i18n.t('settings.keys.save') }}</button>
      </div>
    }
  `,
  styles: [
    `
      .group {
        border: 0;
        padding: 0;
        margin: 0 0 16px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--text-dim);
      }
      .field input {
        padding: 6px 8px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 13px;
      }
      .field input:disabled {
        opacity: 0.5;
      }
      .seg {
        display: flex;
        gap: 6px;
      }
      .seg-btn {
        flex: 1;
        padding: 6px 8px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text-dim);
        font-family: var(--font-ui);
        font-size: 12px;
        cursor: pointer;
      }
      .seg-btn[aria-pressed='true'] {
        border-color: var(--accent-line);
        background: var(--accent-soft);
        color: var(--accent-strong);
      }
      .seg-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .hint {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--text-faint);
      }
      .hint.warning {
        color: var(--warning);
      }
      .key-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        font-size: 13px;
        color: var(--text);
      }
      .badge {
        flex: none;
        padding: 2px 6px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 9px;
        letter-spacing: 0.08em;
        color: var(--text-faint);
      }
      .badge[data-state='app'] {
        border-color: var(--accent-line);
        color: var(--accent-strong);
      }
      .badge[data-state='environment'] {
        border-color: var(--border-strong);
        color: var(--text-dim);
      }
      .key-name {
        font-weight: 500;
        min-width: 70px;
      }
      .key-hint {
        color: var(--text-faint);
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .key-hint.warn {
        color: var(--warning);
      }
      .key-row.unreadable {
        color: var(--text-dim);
      }
      .remove {
        margin-left: auto;
        flex: none;
        padding: 3px 8px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text-dim);
        font-family: var(--font-ui);
        font-size: 11px;
        cursor: pointer;
      }
      .remove:hover {
        border-color: var(--danger);
        color: var(--danger);
      }
      .key-add {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }
      .key-add input {
        flex: 1;
        min-width: 0;
        padding: 6px 8px;
        border: 1px solid var(--border);
        border-radius: var(--r-sm);
        background: var(--surface-raised);
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 13px;
      }
      .save {
        padding: 6px 10px;
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
export class AiSettings {
  readonly desktop = inject(DesktopService)
  readonly i18n = inject(I18nService)
  readonly PROVIDERS = PROVIDERS

  readonly prefs: ProviderPreference[] = ['auto', 'anthropic', 'openai']
  readonly drafts: KeyDraft[] = PROVIDERS.map((p) => ({ provider: p.id, value: '' }))

  readonly forced = computed(() => this.desktop.forcedProvider())
  readonly locked = computed(() => Boolean(this.forced()))
  readonly keys = computed(() => this.desktop.keys())

  readonly prefLabel = computed(() => ({
    auto: this.i18n.t('settings.ai.providerAuto'),
    anthropic: this.i18n.t('settings.ai.providerAnthropic'),
    openai: this.i18n.t('settings.ai.providerOpenai'),
  }))

  /** The three key-row badges: no key, from the environment, or the app hint. */
  badgeLabel(k: { source: KeySource; hint: string | null }): string {
    if (k.source === 'app') return this.i18n.t('settings.keys.hint', { hint: k.hint ?? '' })
    if (k.source === 'environment') return this.i18n.t('settings.keys.badgeEnv')
    return this.i18n.t('settings.keys.badgeNone')
  }

  draft(provider: 'anthropic' | 'openai'): KeyDraft {
    return this.drafts.find((d) => d.provider === provider)!
  }

  setDraft(provider: 'anthropic' | 'openai', value: string): void {
    this.draft(provider).value = value
  }

  async saveDraft(provider: 'anthropic' | 'openai'): Promise<void> {
    const draft = this.draft(provider)
    const value = draft.value.trim()
    if (!value) return
    await this.desktop.saveKey(provider, value)
    // Clear only on success; a failed save must keep the input so the user
    // can correct it (see `opentimbre-secrets`).
    if (!this.desktop.keysError()) draft.value = ''
  }

  async saveKeyForm(provider: 'anthropic' | 'openai'): Promise<void> {
    await this.desktop.removeKey(provider)
  }

  setPreference(pref: ProviderPreference): void {
    void this.desktop.setProviderPreference(pref)
  }
}