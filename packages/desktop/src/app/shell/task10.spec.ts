import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { DESKTOP_API } from '../desktop.service'
import { createFakeDesktopApi, makeAppState } from '../testing/fake-desktop-api'
import { AppShell } from './app-shell'

describe('Task 10 settings and plugin bar', () => {
  let fake: ReturnType<typeof createFakeDesktopApi>

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    fake = createFakeDesktopApi()
    TestBed.configureTestingModule({ providers: [{ provide: DESKTOP_API, useValue: fake }] })
  })

  function render(): { fixture: import('@angular/core/testing').ComponentFixture<AppShell>; el: HTMLElement } {
    const fixture = TestBed.createComponent(AppShell)
    fixture.detectChanges()
    return { fixture, el: fixture.nativeElement as HTMLElement }
  }

  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  function openSettings(el: HTMLElement, fixture: import('@angular/core/testing').ComponentFixture<AppShell>): void {
    const tabs = el.querySelectorAll<HTMLButtonElement>('.pane-tabs button')
    tabs[2].dispatchEvent(new Event('click'))
    fixture.detectChanges()
  }

  it('renders the guitar form with the persisted guitar', async () => {
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    openSettings(el, fixture)
    const form = el.querySelector('ot-guitar-form') as HTMLElement
    expect(form).toBeTruthy()
    expect(form.querySelector<HTMLInputElement>('input')?.value).toBe('Default guitar')
  })

  it('saves a guitar change through the service', async () => {
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    openSettings(el, fixture)
    const form = el.querySelector('ot-guitar-form') as HTMLElement
    const modelInput = form.querySelector<HTMLInputElement>('input')!
    modelInput.value = 'Tele'
    modelInput.dispatchEvent(new Event('input'))
    fixture.detectChanges()
    form.querySelector<HTMLButtonElement>('.save')!.dispatchEvent(new Event('click'))
    await flush()
    expect(fake.calls.setGuitar).toHaveLength(1)
    expect(fake.calls.setGuitar[0].model).toBe('Tele')
  })

  it('renders the AI settings with provider buttons and a key row', async () => {
    fake = createFakeDesktopApi(
      makeAppState({
        keys: [{ provider: 'openai', label: 'OpenAI', env: 'OPENAI_API_KEY', source: 'app', hint: 'sk-…f3a', updatedAt: 'now', protected: true, readable: true }],
      }),
    )
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({ providers: [{ provide: DESKTOP_API, useValue: fake }] })
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    openSettings(el, fixture)
    const ai = el.querySelector('ot-ai-settings') as HTMLElement
    expect(ai).toBeTruthy()
    expect(ai.textContent).toContain('OpenAI')
    expect(ai.textContent).toContain('sk-…f3a')
  })

  it('saves an API key and clears the input immediately', async () => {
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    openSettings(el, fixture)
    const ai = el.querySelector('ot-ai-settings') as HTMLElement
    const inputs = ai.querySelectorAll<HTMLInputElement>('input[type="password"]')
    const openaiInput = inputs[0]
    openaiInput.value = 'sk-secret'
    openaiInput.dispatchEvent(new Event('input'))
    fixture.detectChanges()
    ai.querySelector<HTMLButtonElement>('button.save')!.dispatchEvent(new Event('click'))
    await flush()
    expect(fake.calls.saveKey).toContainEqual(['openai', 'sk-secret'])
    expect(openaiInput.value).toBe('')
  })

  it('keeps the key input and shows the warning when a save fails', async () => {
    fake.saveKey = async () => ({ error: 'Key has whitespace in the middle — paste only the key.' })
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    openSettings(el, fixture)
    const ai = el.querySelector('ot-ai-settings') as HTMLElement
    const openaiInput = ai.querySelector<HTMLInputElement>('input[type="password"]')!
    openaiInput.value = 'sk-a b'
    openaiInput.dispatchEvent(new Event('input'))
    fixture.detectChanges()
    ai.querySelector<HTMLButtonElement>('button.save')!.dispatchEvent(new Event('click'))
    await flush()
    fixture.detectChanges()
    expect(openaiInput.value).toBe('sk-a b')
    expect(ai.textContent).toContain('Key has whitespace in the middle — paste only the key.')
  })

  it('disables AI controls when a provider is forced', async () => {
    fake = createFakeDesktopApi(makeAppState({ forcedProvider: 'openai' }))
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({ providers: [{ provide: DESKTOP_API, useValue: fake }] })
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    openSettings(el, fixture)
    const ai = el.querySelector('ot-ai-settings') as HTMLElement
    const seg = ai.querySelector<HTMLButtonElement>('.seg-btn')!
    expect(seg.disabled).toBe(true)
    const modelInput = ai.querySelector<HTMLInputElement>('input:not([type="password"])')!
    expect(modelInput.disabled).toBe(true)
  })

  it('renders each catalog plugin in the plugin bar', async () => {
    const { el, fixture } = render()
    await flush()
    for (const id of ['gojira', 'soldano', 'tim-henson', 'petrucci']) {
      fake.pushPluginChanged({ id, name: id, installed: true, path: '/x', running: false, mappingStatus: 'ok' })
    }
    fixture.detectChanges()
    const bar = el.querySelector('ot-plugin-bar') as HTMLElement
    expect(bar.querySelectorAll('.plugin').length).toBe(4)
    expect(bar.textContent).toContain('gojira')
  })
})