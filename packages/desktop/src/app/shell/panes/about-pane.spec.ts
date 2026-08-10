import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { DESKTOP_API, DesktopService } from '../../desktop.service'
import { createFakeDesktopApi, makeAppState } from '../../testing/fake-desktop-api'
import { AboutPane } from './about-pane'

describe('AboutPane', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DESKTOP_API, useValue: createFakeDesktopApi(makeAppState({ version: '9.8.7' })) }],
    })
  })

  it('renders the app name, italic platform suffix, version, and tagline', async () => {
    const fixture = TestBed.createComponent(AboutPane)
    TestBed.inject(DesktopService).load()
    await new Promise((resolve) => setTimeout(resolve, 0))
    fixture.detectChanges()
    const el = fixture.nativeElement as HTMLElement
    expect(el.querySelector('.name')).toBeTruthy()
    expect(el.querySelector('.name')?.textContent).toContain('OpenTimbre')
    expect(el.querySelector('.name i')?.textContent).toContain('for Windows')
    expect(el.querySelector('.version')?.textContent).toContain('Version 9.8.7')
    expect(el.querySelector('.tagline')?.textContent).toContain('Guitar tones in natural language')
  })

  it('emits back', () => {
    const fixture = TestBed.createComponent(AboutPane)
    fixture.detectChanges()
    const el = fixture.nativeElement as HTMLElement
    let emitted = false
    fixture.componentInstance.back.subscribe(() => (emitted = true))
    el.querySelector<HTMLButtonElement>('ot-pane-header .back')!.click()
    expect(emitted).toBe(true)
  })
})