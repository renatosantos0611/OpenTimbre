import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ModelInfo } from '@opentimbre/contracts'
import { DESKTOP_API, DesktopService } from '../desktop.service'
import { createFakeDesktopApi, makeAppState } from '../testing/fake-desktop-api'
import { ModelMenu } from './model-menu'

const MODELS: ModelInfo[] = [
  { provider: 'openai', id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'high' },
  { provider: 'openai', id: 'gpt-5.2', label: 'GPT-5.2', tier: 'mid' },
  { provider: 'anthropic', id: 'claude-sonnet-4', label: 'claude-sonnet-4', tier: 'mid' },
]

describe('ModelMenu', () => {
  let fake: ReturnType<typeof createFakeDesktopApi>
  let desktop: DesktopService

  beforeEach(() => {
    fake = createFakeDesktopApi(
      makeAppState({ ai: { provider: 'openai', label: 'OpenAI', model: 'gpt-5.6-sol', modelLabel: 'GPT-5.6 Sol', available: [] } }),
    )
    fake.listModels = async () => MODELS
    TestBed.configureTestingModule({ providers: [{ provide: DESKTOP_API, useValue: fake }] })
    desktop = TestBed.inject(DesktopService)
    desktop.load()
  })

  async function render(): Promise<{ fixture: import('@angular/core/testing').ComponentFixture<ModelMenu>; el: HTMLElement }> {
    const fixture = TestBed.createComponent(ModelMenu)
    fixture.detectChanges()
    await new Promise((resolve) => setTimeout(resolve, 0))
    fixture.detectChanges()
    return { fixture, el: fixture.nativeElement as HTMLElement }
  }

  it('shows the active model label on the button', async () => {
    const { el } = await render()
    expect(el.querySelector('.model-btn .label')?.textContent).toContain('GPT-5.6 Sol')
  })

  it('opens a searchable list grouped by tier', async () => {
    const { el, fixture } = await render()
    el.querySelector<HTMLButtonElement>('.model-btn')!.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    expect(el.querySelector('.search')).toBeTruthy()
    const tags = Array.from(el.querySelectorAll('.group-tag')).map((t) => t.textContent)
    expect(tags).toContain('Mid cost')
    expect(tags).toContain('High cost')
    expect(el.querySelectorAll('.item').length).toBe(MODELS.length)
  })

  it('filters as you type', async () => {
    const { el, fixture } = await render()
    el.querySelector<HTMLButtonElement>('.model-btn')!.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    const input = el.querySelector<HTMLInputElement>('.search input')!
    input.value = 'claude'
    input.dispatchEvent(new Event('input'))
    fixture.detectChanges()
    expect(el.querySelectorAll('.item').length).toBe(1)
    expect(el.querySelector('.item-name')?.textContent).toContain('claude-sonnet-4')
  })

  it('clicking into the search input keeps the panel open', async () => {
    const { el, fixture } = await render()
    el.querySelector<HTMLButtonElement>('.model-btn')!.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    const input = el.querySelector<HTMLInputElement>('.search input')!
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    fixture.detectChanges()
    expect(el.querySelector('.panel')).toBeTruthy()
  })

  it('shows an explanatory line for an empty list', async () => {
    fake.listModels = async () => []
    const { el, fixture } = await render()
    el.querySelector<HTMLButtonElement>('.model-btn')!.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    expect(el.querySelector('.degraded')?.textContent).toContain('add an API key')
  })

  it('shows an explanatory line when loading fails', async () => {
    fake.listModels = async () => ({ error: 'boom' })
    const { el, fixture } = await render()
    el.querySelector<HTMLButtonElement>('.model-btn')!.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    expect(el.querySelector('.degraded')?.textContent).toContain("Couldn't load")
  })

  it('selecting a model persists it through setModel', async () => {
    const { el, fixture } = await render()
    el.querySelector<HTMLButtonElement>('.model-btn')!.dispatchEvent(new Event('click'))
    fixture.detectChanges()
    const item = Array.from(el.querySelectorAll<HTMLButtonElement>('.item')).find((i) =>
      i.textContent?.includes('GPT-5.6'),
    )!
    item.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fake.calls.setModel).toContainEqual(['openai', 'gpt-5.6-sol'])
  })
})