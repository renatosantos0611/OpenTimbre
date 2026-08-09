import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { DESKTOP_API, DesktopService } from '../../desktop.service'
import { createFakeDesktopApi } from '../../testing/fake-desktop-api'
import { ChatPane } from './chat-pane'

describe('ChatPane', () => {
  let fake: ReturnType<typeof createFakeDesktopApi>
  let desktop: DesktopService

  beforeEach(() => {
    fake = createFakeDesktopApi()
    TestBed.configureTestingModule({ providers: [{ provide: DESKTOP_API, useValue: fake }] })
    desktop = TestBed.inject(DesktopService)
  })

  async function render(): Promise<{ fixture: import('@angular/core/testing').ComponentFixture<ChatPane>; el: HTMLElement }> {
    const fixture = TestBed.createComponent(ChatPane)
    desktop.load()
    await new Promise((resolve) => setTimeout(resolve, 0))
    fixture.detectChanges()
    return { fixture, el: fixture.nativeElement as HTMLElement }
  }

  it('renders the invite block with icon, heading, paragraph, and chips when empty', async () => {
    const { el } = await render()
    expect(el.querySelector('.invite')).toBeTruthy()
    expect(el.querySelector('.invite-title')?.textContent).toContain('Build your tone')
    expect(el.textContent).toContain('Describe the sound you want')
    expect(el.querySelectorAll('.chip').length).toBe(4)
  })

  it('clicking a chip fills the composer draft and does not send', async () => {
    const { el } = await render()
    const firstChip = el.querySelector<HTMLButtonElement>('.chip')!
    firstChip.click()
    expect(desktop.draft()).toBe(firstChip.textContent)
    expect(fake.calls.sendChat).toHaveLength(0)
  })

  it('hides the invite block once messages exist', async () => {
    const { el, fixture } = await render()
    await desktop.sendChat('hello')
    fixture.detectChanges()
    expect(el.querySelector('.invite')).toBeNull()
    expect(el.querySelector('.row')).toBeTruthy()
  })
})