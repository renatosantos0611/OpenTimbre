import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { DESKTOP_API, DesktopService } from '../desktop.service'
import { createFakeDesktopApi } from '../testing/fake-desktop-api'
import { AppShell } from './app-shell'

/**
 * The update banner is one extra row inside the status bar, driven by the
 * `updater:status` push: available (confirm), downloading (percent),
 * ready (restart), error (retry), and dismiss hiding the row for the session.
 */
describe('update banner', () => {
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

  function banner(el: HTMLElement): HTMLElement | null {
    return el.querySelector('ot-status-bar .update')
  }

  function click(button: HTMLButtonElement): void {
    button.dispatchEvent(new Event('click'))
  }

  it('shows no update row before any status arrives', async () => {
    const { el, fixture } = render()
    await flush()
    fixture.detectChanges()
    expect(TestBed.inject(DesktopService).updaterStatus()).toBeNull()
    expect(banner(el)).toBeNull()
  })

  it('renders the available state with the version and a confirm action', async () => {
    const { el, fixture } = render()
    await flush()
    fake.pushUpdaterStatus({ state: 'available', version: '2.0.0' })
    fixture.detectChanges()
    const row = banner(el)!
    expect(row.getAttribute('data-state')).toBe('available')
    expect(row.textContent).toContain('Version 2.0.0 is available')
    const confirm = row.querySelector<HTMLButtonElement>('.confirm')!
    expect(confirm.textContent).toContain('Update')
    expect(row.querySelector<HTMLButtonElement>('.dismiss')).toBeTruthy()
    click(confirm)
    await flush()
    expect(fake.calls.downloadUpdate).toBe(1)
  })

  it('renders the downloading state with the percent', async () => {
    const { el, fixture } = render()
    await flush()
    fake.pushUpdaterStatus({ state: 'downloading', percent: 42 })
    fixture.detectChanges()
    const row = banner(el)!
    expect(row.getAttribute('data-state')).toBe('downloading')
    expect(row.textContent).toContain('Downloading update… 42%')
    // No actions while the download is in flight.
    expect(row.querySelector('button')).toBeNull()
  })

  it('rounds the download percent to a whole number', async () => {
    const { el, fixture } = render()
    await flush()
    fake.pushUpdaterStatus({ state: 'downloading', percent: 61.7 })
    fixture.detectChanges()
    expect(banner(el)!.textContent).toContain('Downloading update… 62%')
  })

  it('renders the ready state with a restart action', async () => {
    const { el, fixture } = render()
    await flush()
    fake.pushUpdaterStatus({ state: 'ready' })
    fixture.detectChanges()
    const row = banner(el)!
    expect(row.getAttribute('data-state')).toBe('ready')
    expect(row.textContent).toContain('Restart to update')
    const restart = row.querySelector<HTMLButtonElement>('.confirm')!
    expect(restart.textContent).toContain('Restart')
    click(restart)
    await flush()
    expect(fake.calls.installUpdate).toBe(1)
  })

  it('renders the error state with the message, retry, and dismiss', async () => {
    const { el, fixture } = render()
    await flush()
    fake.pushUpdaterStatus({ state: 'error', message: 'Signature check failed' })
    fixture.detectChanges()
    const row = banner(el)!
    expect(row.getAttribute('data-state')).toBe('error')
    expect(row.textContent).toContain('Update failed')
    expect(row.textContent).toContain('Signature check failed')
    expect(row.querySelector('.dot.danger')).toBeTruthy()
    const retry = row.querySelector<HTMLButtonElement>('.confirm')!
    expect(retry.textContent).toContain('Retry')
    click(retry)
    await flush()
    expect(fake.calls.downloadUpdate).toBe(1)
  })

  it('dismiss hides the banner and keeps it hidden for the session', async () => {
    const { el, fixture } = render()
    await flush()
    fake.pushUpdaterStatus({ state: 'available', version: '2.0.0' })
    fixture.detectChanges()
    click(banner(el)!.querySelector<HTMLButtonElement>('.dismiss')!)
    fixture.detectChanges()
    expect(banner(el)).toBeNull()
    // A later push in the same session stays hidden; only a restart re-notifies.
    fake.pushUpdaterStatus({ state: 'ready' })
    fixture.detectChanges()
    expect(banner(el)).toBeNull()
  })

  it('dismisses the error state the same way', async () => {
    const { el, fixture } = render()
    await flush()
    fake.pushUpdaterStatus({ state: 'error', message: 'boom' })
    fixture.detectChanges()
    click(banner(el)!.querySelector<HTMLButtonElement>('.dismiss')!)
    fixture.detectChanges()
    expect(banner(el)).toBeNull()
  })

  it('stops pushing status once the service is destroyed', async () => {
    render()
    await flush()
    const service = TestBed.inject(DesktopService)
    TestBed.resetTestingModule()
    fake.pushUpdaterStatus({ state: 'ready' })
    expect(service.updaterStatus()).toBeNull()
  })
})
