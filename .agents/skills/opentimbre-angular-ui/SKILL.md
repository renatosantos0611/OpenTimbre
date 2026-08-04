---
name: opentimbre-angular-ui
description: Conventions for the OpenTimbre renderer on Angular 22 — signal-first state, zoneless change detection, standalone components, and a service layer that owns the bridge to the desktop process. Use whenever you create or edit an Angular component, service, template, or style; wire UI state; handle a stream of chat or status updates; build a form for settings or API keys; or decide between a signal and an observable. Also use when a component is about to call `window.api` directly, or when a task mentions NgModule, Zone.js, or reactive forms. NEVER put IPC calls or domain rules in a component.
---

# OpenTimbre — Angular renderer

Grounded in Angular 22.1.0 (the version currently published on npm). Angular 22 shipped
2026-06-03; the notes below reflect its stated defaults. Confirm any specific API against the
current angular.dev docs before relying on a signature — this skill fixes conventions, not
signatures.

## The renderer's job

The renderer draws and collects intent. It holds **no domain rule**. Whether a knob value is legal,
which CC an amp maps to, whether a key is valid — all of that lives behind the bridge. A component
that knows a CC number has already broken `opentimbre-plugin-spec`.

## Angular 22 defaults — keep them

| Default in v22 | Keep it because |
| --- | --- |
| **Zoneless** change detection | Zone.js patches every async primitive; a desktop app driven by IPC push events has no reason to pay that. Signals notify precisely. |
| **OnPush** on new components | Consistent with zoneless; makes accidental global re-render impossible. |
| **Standalone** components | No NgModule wiring. Import what the template uses. |
| **Signal Forms** (stable in v22) | The settings and key-entry screens are forms over signal state; mixing in reactive forms means two state models in one screen. |
| **Vitest** as the test runner | New projects default to it. Do not add a second runner for the renderer. |

Do not reintroduce NgModules, Zone.js, or `ChangeDetectionStrategy.Default` to make something work.
If a value does not update, the cause is state held outside a signal — fix that.

## State: signals first

- Component and service state is `signal()` / `computed()`.
- Derived display values are `computed()`, never a field recalculated in a method called from the
  template.
- Use `resource()` for a value that is fetched and can be in loading/error/success — the status
  flags come with it instead of being three hand-rolled signals.
- Reach for RxJS only for genuine event streams over time where operators earn their keep
  (debouncing typed input, for instance). A one-shot `invoke` is a promise; do not wrap it in an
  observable to feel consistent.

Push channels from main (`chat:status`, `plugin:mudou`, theme changes) land in a service, which
converts them into signals. Components read signals; they never register IPC listeners.

## The bridge lives in services

```text
window.api                 ← exists only inside one service per domain area
  ChatService              ← enviar, novaConversa, onStatus → signals
  PluginService            ← estadoPlugin, abrirPlugin, instalarMapeamento
  SettingsService          ← chaves, tema, guitarra, provedor
  components               ← inject the services; never touch window.api
```

Why this matters beyond tidiness: the bridge is the untrusted boundary. Concentrating it makes the
whole surface reviewable in a handful of files, and makes the renderer testable with a fake service
instead of a fake Electron.

Every service that registers a push listener must expose teardown, and every component that
registers must unregister on destroy — see `opentimbre-electron-ipc`.

## Dependency injection

Use `inject()` in field initializers rather than constructor parameters. It reads better with
signals and works in functions (guards, resolvers, factories).

## Templates

- Use the built-in control flow (`@if`, `@for`, `@switch`). `@for` requires `track` — provide a
  stable identity, not `$index`, for anything that can reorder (conversation list, plugin list).
- Selectorless imports are available in v22; use them for components used in one or two places
  rather than inventing a selector nobody types.
- Keep logic out of templates. A condition worth naming is a `computed()`.

## The window is small and always on top

The legacy window is 420×700, always-on-top, and goes translucent when the plugin takes focus. That
constrains the UI more than a typical web app:

- Design for a narrow column. There is no wide breakpoint to fall back on.
- The chat transcript is the scroll surface; chrome around it stays fixed.
- Contrast must survive the translucent state — test it there, not only at full opacity.
- Theme is delivered at startup outside IPC to avoid a flash; the renderer must apply it on its
  first executed line.

## Styling

Component-scoped styles by default. Global styles carry only design tokens (color, spacing, type
scale) and resets. Themes switch by swapping token values on a root attribute, never by
conditionally importing stylesheets.

## Review checklist

1. Does any component reference `window.api`?
2. Does any component hold a domain rule, a CC value, or a plugin name?
3. Is state a signal, or a mutable field that happens to render?
4. Was `ChangeDetectionStrategy.Default`, Zone.js, or an NgModule introduced to fix an update bug?
5. Does every `@for` have a meaningful `track`?
6. Do push-channel listeners get torn down?

## Related

`opentimbre-electron-ipc` (the contract the services wrap), `opentimbre-core-boundary` (why the
renderer holds no rules), `opentimbre-testing` (renderer tests use fake services).
