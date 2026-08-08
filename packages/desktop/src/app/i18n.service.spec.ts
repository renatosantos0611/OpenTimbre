import { TestBed } from '@angular/core/testing'
import { effect, Injector } from '@angular/core'
import { describe, expect, it, beforeEach } from 'vitest'
import { I18nService } from './i18n.service'

describe('I18nService', () => {
  let i18n: I18nService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    i18n = TestBed.inject(I18nService)
  })

  it('defaults to English and resolves a key', () => {
    expect(i18n.locale()).toBe('en')
    expect(i18n.t('shell.pane.chat')).toBe('Chat')
  })

  it('switches the catalog with the locale', () => {
    i18n.setLocale('pt')
    expect(i18n.locale()).toBe('pt')
    expect(i18n.t('shell.pane.chat')).toBe('Chat')
    expect(i18n.t('shell.pane.settings')).toBe('Configurações')
  })

  it('interpolates params into a template', () => {
    expect(i18n.t('shell.status.version', { version: '1.2.3' })).toBe('Version 1.2.3')
  })

  it('re-evaluates a tracked consumer when the locale changes', () => {
    const reads: string[] = []
    const runner = effect(
      () => reads.push(i18n.t('shell.pane.settings')),
      { injector: TestBed.inject(Injector) },
    )
    TestBed.flushEffects()
    expect(reads).toEqual(['Settings'])
    i18n.setLocale('pt')
    TestBed.flushEffects()
    expect(reads).toEqual(['Settings', 'Configurações'])
    runner.destroy()
  })
})