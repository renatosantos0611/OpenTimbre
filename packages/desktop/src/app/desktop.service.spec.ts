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
})