import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { DESKTOP_API, DesktopService } from './desktop.service'
import { createFakeDesktopApi, makeAppState } from './testing/fake-desktop-api'

describe('DesktopService', () => {
  let service: DesktopService
  let fake: ReturnType<typeof createFakeDesktopApi>

  function provide(api: ReturnType<typeof createFakeDesktopApi>): void {
    TestBed.configureTestingModule({ providers: [{ provide: DESKTOP_API, useValue: api }] })
  }

  beforeEach(() => {
    fake = createFakeDesktopApi()
    provide(fake)
    service = TestBed.inject(DesktopService)
  })

  it('loads AppState into its signals', async () => {
    await service.load()
    expect(service.ready()).toBe(true)
    expect(service.loadError()).toBeNull()
    expect(service.version()).toBe('0.0.0')
    expect(service.themeChosen()).toBe('dark')
    expect(service.resolvedTheme()).toBe('dark')
    expect(service.dimOnUnfocus()).toBe(false)
    expect(service.midi().port).toBe('Virtual Port')
  })

  it('forwards the loaded locale to I18nService', async () => {
    TestBed.resetTestingModule()
    const pt = createFakeDesktopApi(makeAppState({ locale: 'pt' }))
    provide(pt)
    service = TestBed.inject(DesktopService)
    await service.load()
    expect(service.locale()).toBe('pt')
  })

  it('sets ready and loadError when getState fails, and keeps the catalog', async () => {
    fake.getState = async () => ({ error: 'boom' })
    await service.load()
    expect(service.ready()).toBe(true)
    expect(service.loadError()).toBe('boom')
    expect(service.locale()).toBe('en')
  })

  it('reflects a chat:status push into the signal', async () => {
    await service.load()
    fake.pushChatStatus('querying')
    expect(service.chatStatus()).toBe('querying')
    fake.pushChatStatus(null)
    expect(service.chatStatus()).toBeNull()
  })

  it('reflects a theme-changed push into the signal', async () => {
    await service.load()
    fake.pushThemeChanged('light')
    expect(service.resolvedTheme()).toBe('light')
  })

  it('records a theme change through the bridge', async () => {
    await service.load()
    await service.setTheme('light')
    expect(fake.calls.setTheme).toEqual(['light'])
  })

  it('records a locale change and updates the signal', async () => {
    await service.load()
    await service.setLocale('pt')
    expect(fake.calls.setLocale).toEqual(['pt'])
    expect(service.locale()).toBe('pt')
  })

  it('appends a user + ai turn to the transcript on a successful send', async () => {
    await service.load()
    fake.sendChat = async (text) => ({ text, rig: null, cards: null })
    await service.sendChat('a heavy chug')
    expect(service.transcript()).toEqual([
      { role: 'user', text: 'a heavy chug' },
      { role: 'ai', text: 'a heavy chug' },
    ])
    expect(service.busy()).toBe(false)
  })

  it('marks busy while a provider call is in flight', async () => {
    await service.load()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    fake.sendChat = async (text) => {
      await gate
      return { text, rig: null, cards: null }
    }
    const pending = service.sendChat('hello')
    expect(service.busy()).toBe(true)
    release()
    await pending
    expect(service.busy()).toBe(false)
  })

  it('appends a user + error message when the provider call fails', async () => {
    await service.load()
    fake.sendChat = async () => ({ error: 'The AI couldn\'t answer.' })
    await service.sendChat('hello')
    expect(service.transcript()).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'error', text: 'The AI couldn\'t answer.' },
    ])
    expect(service.busy()).toBe(false)
  })

  it('clears the transcript and conversation on newChat', async () => {
    await service.load()
    await service.sendChat('hello')
    await service.newChat()
    expect(service.transcript()).toEqual([])
    expect(service.currentConversation()).toBeNull()
  })

  it('loads a conversation transcript on open', async () => {
    await service.load()
    fake.openConversation = async () => ({
      id: 'c1',
      title: 't',
      messages: [{ role: 'user', text: 'hi' }],
      plugin: null,
      memoryLost: false,
    })
    await service.openConversation('c1')
    expect(service.transcript()).toEqual([{ role: 'user', text: 'hi' }])
  })

  it('forwards applyRig and clears the busy flag', async () => {
    await service.load()
    const result = await service.applyRig('base')
    expect(fake.calls.applyRig).toEqual(['base'])
    expect(result).toEqual({ scene: 'base', amp: 'Rust', ccsSent: 3, ms: 12, warnings: [] })
  })

  it('surfaces a key-save failure through keysError and keeps applying the next success', async () => {
    await service.load()
    fake.saveKey = async () => ({ error: 'Key has whitespace in the middle — paste only the key.' })
    await service.saveKey('openai', 'sk-a b')
    expect(service.keysError()).toBe('Key has whitespace in the middle — paste only the key.')
    fake.saveKey = async () => makeAppState()
    await service.saveKey('openai', 'sk-ok')
    expect(service.keysError()).toBeNull()
  })

  it('unsubscribes push listeners when its injector is destroyed', async () => {
    const child = createEnvironmentInjector(
      [{ provide: DESKTOP_API, useValue: fake }, DesktopService],
      TestBed.inject(EnvironmentInjector),
    )
    const svc = child.get(DesktopService)
    await svc.load()
    fake.pushChatStatus('querying')
    expect(svc.chatStatus()).toBe('querying')
    child.destroy()
    fake.pushChatStatus('correcting')
    expect(svc.chatStatus()).toBe('querying')
  })

  it('records a guitar change through the bridge', async () => {
    await service.load()
    const guitar = { model: 'Tele', pickups: 'single' as const, tuning: 'Drop D', strings: 6 }
    await service.setGuitar(guitar)
    expect(fake.calls.setGuitar).toEqual([guitar])
  })

  it('records a model change through the bridge', async () => {
    await service.load()
    await service.setModel('openai', 'gpt-4o-mini')
    expect(fake.calls.setModel).toEqual([['openai', 'gpt-4o-mini']])
  })

  it('saves a key and applies the returned state', async () => {
    await service.load()
    fake.saveKey = async () => {
      fake.calls.saveKey.push(['openai', 'sk-secret'])
      return makeAppState({
        keys: [{ provider: 'openai', label: 'OpenAI', env: 'OPENAI_API_KEY', source: 'app', hint: 'sk-…f3a', updatedAt: 'now', protected: true, readable: true }],
      })
    }
    await service.saveKey('openai', 'sk-secret')
    expect(fake.calls.saveKey).toEqual([['openai', 'sk-secret']])
    expect(service.keys()).toHaveLength(1)
  })

  it('removes a key through the bridge', async () => {
    await service.load()
    await service.removeKey('openai')
    expect(fake.calls.removeKey).toEqual(['openai'])
  })

  it('records a provider preference through the bridge', async () => {
    await service.load()
    await service.setProviderPreference('anthropic')
    expect(fake.calls.setProviderPreference).toEqual(['anthropic'])
  })

  it('loads a single plugin state through the bridge', async () => {
    await service.load()
    await service.getPluginState('gojira')
    expect(fake.calls.getPluginState).toEqual(['gojira'])
  })
})