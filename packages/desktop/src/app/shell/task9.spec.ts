import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { DESKTOP_API, DesktopService } from '../desktop.service'
import { createFakeDesktopApi } from '../testing/fake-desktop-api'
import { AppShell } from './app-shell'

describe('Task 9 components (chat, cards, history, composer)', () => {
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

  it('renders a user + ai turn in the transcript', async () => {
    const { el, fixture } = render()
    fake.sendChat = async () => ({ text: 'a heavy chug', rig: null, cards: null })
    await flush()
    await TestBed.inject(DesktopService).sendChat('a heavy chug')
    fixture.detectChanges()
    expect(el.querySelector('ot-chat-pane')?.textContent).toContain('a heavy chug')
  })

  it('renders a rig card with an apply button and expands its body', async () => {
    const { el, fixture } = render()
    const rig = {
      plugin: 'gojira',
      song: 'Song',
      artist: 'Artist',
      amp: 'Rust',
      note: 'note',
      scenes: {
        base: {
          title: 'Base',
          summary: 'a riff base',
          explanation: 'why it works',
          guitar: { pickupPosition: 'bridge', volume: 8, tone: 5, technique: 'palm mute' },
          params: {},
        },
      },
    }
    fake.sendChat = async () => ({
      text: 'here',
      rig,
      cards: {
        base: {
          values: [{ label: 'Gain', value: '6' }],
          pedals: [{ name: 'Boost', detail: '' }],
        },
      },
    })
    await flush()
    await TestBed.inject(DesktopService).sendChat('make it heavy')
    fixture.detectChanges()
    const pane = el.querySelector('ot-chat-pane') as HTMLElement
    expect(pane.querySelector('ot-rig-card')).toBeTruthy()
    expect(pane.textContent).toContain('Base')
    expect(pane.textContent).toContain('Gain')
    // Expand button reveals the explanation.
    const expand = pane.querySelector<HTMLButtonElement>('.expand')!
    expand.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    expect(pane.textContent).toContain('why it works')
  })

  it('shows an error row when the provider call fails', async () => {
    const { el, fixture } = render()
    fake.sendChat = async () => ({ error: 'The AI couldn\'t answer.' })
    await flush()
    await TestBed.inject(DesktopService).sendChat('hello')
    fixture.detectChanges()
    expect(el.querySelector('ot-chat-pane')?.textContent).toContain('The AI couldn\'t answer.')
  })

  it('disables the composer while a provider call is in flight', async () => {
    const { el, fixture } = render()
    await flush()
    const textarea = el.querySelector<HTMLTextAreaElement>('ot-composer textarea')!
    textarea.value = 'hello'
    textarea.dispatchEvent(new Event('input'))
    fixture.detectChanges()
    const send = el.querySelector<HTMLButtonElement>('ot-composer .send')!
    expect(send.disabled).toBe(false)
    // Force busy through the service.
    TestBed.inject(DesktopService).busy.set(true)
    fixture.detectChanges()
    expect(send.disabled).toBe(true)
  })

  it('deletes a conversation through the confirmation dialog', async () => {
    fake.listConversations = async () => [
      { id: 'c1', title: 'Tone hunt', updatedAt: 'now', turns: 3 },
    ]
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    // Navigate to the history pane.
    const tabs = el.querySelectorAll<HTMLButtonElement>('.pane-tabs button')
    tabs[1].dispatchEvent(new Event('click'))
    fixture.detectChanges()
    const del = el.querySelector<HTMLButtonElement>('ot-history-pane .del')!
    del.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    expect(el.querySelector<HTMLElement>('[role="alertdialog"]')?.getAttribute('aria-label')).toBe(
      'Delete conversation',
    )
    expect(el.textContent).toContain('Delete this conversation?')
    const confirm = el.querySelector<HTMLButtonElement>('ot-history-pane .danger')!
    confirm.dispatchEvent(new Event('click'))
    await flush()
    expect(fake.calls.deleteConversation).toEqual(['c1'])
  })

  it('starts a new chat from the composer', async () => {
    const { el, fixture } = render()
    await flush()
    await TestBed.inject(DesktopService).sendChat('hello')
    fixture.detectChanges()
    expect(el.querySelector('ot-chat-pane')?.textContent).toContain('hello')
    const newBtn = el.querySelector<HTMLButtonElement>('ot-composer .new')!
    expect(newBtn).toBeTruthy()
    newBtn.dispatchEvent(new Event('click'))
    await flush()
    fixture.detectChanges()
    expect(el.querySelector('ot-chat-pane')?.textContent).toContain('Describe a tone to begin.')
  })
})