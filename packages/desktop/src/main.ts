/**
 * Renderer entry point. Bootstraps the shell zoneless (Angular 22 default; no
 * Zone.js, no `provideZoneChangeDetection`), providing the two services the
 * shell reads. The preload has already populated `window.api` and the CSP
 * forbids remote code, so nothing here touches a network.
 */
import { provideZonelessChangeDetection } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { AppShell } from './app/shell/app-shell'

bootstrapApplication(AppShell, {
  providers: [provideZonelessChangeDetection()],
}).catch((error: unknown) => console.error(error))