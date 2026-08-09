import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { DESKTOP_API, DesktopService } from '../desktop.service'
import { createFakeDesktopApi } from '../testing/fake-desktop-api'
import { Composer } from './composer'

describe('Composer', () => {
  let desktop: DesktopService

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESKTOP_API, useValue: createFakeDesktopApi() }],
    })
    desktop = TestBed.inject(DesktopService)
  })

  function render(): { fixture: import('@angular/core/testing').ComponentFixture<Composer>; el: HTMLElement } {
    const fixture = TestBed.createComponent(Composer)
    fixture.detectChanges()
    return { fixture, el: fixture.nativeElement as HTMLElement }
  }

  it('renders the hint line', () => {
    const { el } = render()
    expect(el.querySelector('.hint')?.textContent).toContain('Enter sends')
  })

  it('shows Manual when autoApply is off and Auto when on', async () => {
    const { el, fixture } = render()
    expect(el.querySelector('.mode-btn')?.textContent).toContain('Manual')
    await desktop.setAutoApply(true)
    fixture.detectChanges()
    expect(el.querySelector('.mode-btn')?.textContent).toContain('Auto')
  })

  it('choosing Auto in the menu sets autoApply through the service', () => {
    const { el, fixture } = render()
    el.querySelector<HTMLButtonElement>('.mode-btn')!.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    const options = el.querySelectorAll<HTMLButtonElement>('.option')
    options[1].click()
    fixture.detectChanges()
    expect(desktop.autoApply()).toBe(true)
  })
})