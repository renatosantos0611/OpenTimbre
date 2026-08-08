import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppShell } from './app-shell'
import { DESKTOP_API } from '../desktop.service'
import { createFakeDesktopApi } from '../testing/fake-desktop-api'

describe('AppShell', () => {
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

  /** Waits a macrotask so the async `load()` promise resolves. */
  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  it('renders every shell band', () => {
    const { el } = render()
    expect(el.querySelector('ot-titlebar')).toBeTruthy()
    expect(el.querySelector('ot-status-bar')).toBeTruthy()
    expect(el.querySelector('ot-plugin-bar')).toBeTruthy()
    expect(el.querySelector('.pane-tabs')).toBeTruthy()
    expect(el.querySelector('ot-composer')).toBeTruthy()
  })

  it('applies the resolved theme to the document root', async () => {
    const { fixture } = render()
    fake.pushThemeChanged('light')
    TestBed.flushEffects()
    fixture.detectChanges()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('starts on the chat pane', () => {
    const { el } = render()
    const panes = el.querySelectorAll<HTMLElement>('.pane')
    expect(panes[0].classList.contains('is-active')).toBe(true)
  })

  it('switches panes and keeps the chat pane mounted', () => {
    const { el, fixture } = render()
    const panes = el.querySelectorAll<HTMLElement>('.pane')
    const tabs = el.querySelectorAll<HTMLButtonElement>('.pane-tabs button')

    tabs[2].dispatchEvent(new Event('click'))
    fixture.detectChanges()
    expect(panes[2].classList.contains('is-active')).toBe(true)
    expect(panes[0].classList.contains('is-active')).toBe(false)
    // The chat pane is still in the DOM, so its scroll/draft survive.
    expect(el.querySelector('ot-chat-pane')).toBeTruthy()

    tabs[0].dispatchEvent(new Event('click'))
    fixture.detectChanges()
    expect(panes[0].classList.contains('is-active')).toBe(true)
  })

  it('renders the empty chat state', async () => {
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    expect(el.querySelector('ot-chat-pane')?.textContent).toContain('Describe a tone to begin.')
  })

  it('shows a degraded state when loading fails', async () => {
    fake.getState = async () => ({ error: 'boom' })
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    expect(el.querySelector('ot-chat-pane')?.textContent).toContain("Couldn't load the app state.")
  })
})