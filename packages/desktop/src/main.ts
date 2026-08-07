import { Component, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'

@Component({
  selector: 'ot-root',
  standalone: true,
  template: `
    <main class="shell">
      <header class="titlebar"><strong>OpenTimbre</strong><span>Desktop shell</span></header>
      <section class="content"><h1>{{ title() }}</h1><p>Ready for the rig conversation.</p></section>
      <footer class="composer">Describe a tone to begin.</footer>
    </main>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .shell { min-height: 100vh; display: grid; grid-template-rows: 42px 1fr 64px; background: #17151c; color: #f4f0f7; }
    .titlebar, .composer { display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid #342c3a; }
    .titlebar { justify-content: space-between; -webkit-app-region: drag; }
    .titlebar span, p, .composer { color: #b9afc1; font: 15px 'Source Sans 3', sans-serif; }
    .content { padding: 24px 18px; } h1 { margin: 0 0 8px; font: 600 24px 'Barlow', sans-serif; }
    .composer { border-top: 1px solid #342c3a; border-bottom: 0; }
  `],
})
class AppComponent {
  readonly title = signal('OpenTimbre')
}

bootstrapApplication(AppComponent).catch((error: unknown) => console.error(error))
