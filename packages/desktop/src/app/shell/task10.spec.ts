import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { DESKTOP_API, DesktopService } from '../desktop.service'
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
    const actions = el.querySelectorAll<HTMLButtonElement>('ot-status-bar .actions .icon')
    actions[2].dispatchEvent(new Event('click'))
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
  })

  it('shows no plugin until the conversation has a suggestion', async () => {
    const { el, fixture } = render()
    await flush()
    for (const id of ['gojira', 'soldano', 'tim-henson', 'petrucci']) {
      fake.pushPluginChanged({ id, name: id, installed: true, path: '/x', running: false, mappingStatus: 'ok' })
    }
    fixture.detectChanges()
    const bar = el.querySelector('ot-plugin-bar') as HTMLElement
    expect(bar.querySelectorAll('.plugin').length).toBe(0)
  })

  it('shows only the plugin the AI suggested for the open conversation', async () => {
    fake.openConversation = async () => ({
      id: 'c1',
      title: 'Tone hunt',
      messages: [],
      plugin: 'gojira',
      memoryLost: false,
    })
    const { el, fixture } = render()
    await flush()
    for (const id of ['gojira', 'soldano', 'tim-henson', 'petrucci']) {
      fake.pushPluginChanged({ id, name: id, installed: true, path: '/x', running: false, mappingStatus: 'ok' })
    }
    await TestBed.inject(DesktopService).openConversation('c1')
    fixture.detectChanges()
    const bar = el.querySelector('ot-plugin-bar') as HTMLElement
    expect(bar.querySelectorAll('.plugin').length).toBe(1)
    expect(bar.textContent).toContain('gojira')
  })

  it('shows the suggested plugin live, right after the AI answers in a brand-new chat', async () => {
    fake.sendChat = async () => ({
      text: 'here',
      rig: { plugin: 'soldano', song: 's', artist: 'a', amp: 'CLN', note: '', scenes: {} },
      cards: null,
      conversationId: 'new-1',
      autoApplied: null,
    })
    const { el, fixture } = render()
    await flush()
    fake.pushPluginChanged({ id: 'soldano', name: 'soldano', installed: true, path: '/x', running: false, mappingStatus: 'ok' })
    await TestBed.inject(DesktopService).sendChat('give me a Soldano tone')
    fixture.detectChanges()
    const bar = el.querySelector('ot-plugin-bar') as HTMLElement
    expect(bar.querySelectorAll('.plugin').length).toBe(1)
    expect(bar.textContent).toContain('soldano')
  })

  it('shows a suggested plugin even when its boot-poll push never arrived (a startup race)', async () => {
    fake.sendChat = async () => ({
      text: 'here',
      rig: { plugin: 'petrucci', song: 's', artist: 'a', amp: 'CLN', note: '', scenes: {} },
      cards: null,
      conversationId: 'new-2',
      autoApplied: null,
    })
    const { el, fixture } = render()
    await flush()
    // No pushPluginChanged for 'petrucci' — the renderer never learned its state from the poll.
    await TestBed.inject(DesktopService).sendChat('give me a Petrucci tone')
    fixture.detectChanges()
    TestBed.flushEffects()
    await flush()
    fixture.detectChanges()
    const bar = el.querySelector('ot-plugin-bar') as HTMLElement
    // The fake's getPluginState always answers for whatever id it's asked about — the point here
    // is that the fallback fetch actually asked for 'petrucci' and the chip rendered from it.
    expect(fake.calls.getPluginState).toContain('petrucci')
    expect(bar.querySelectorAll('.plugin').length).toBe(1)
  })
})