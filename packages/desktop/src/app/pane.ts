/**
 * The three local panes of the shell. They are shell state, not navigable
 * pages — there is no router, so switching between them is a `signal`, and the
 * panes stay mounted so chat content, draft, and scroll survive a switch.
 */
export type Pane = 'chat' | 'history' | 'settings'

export const PANES: readonly Pane[] = ['chat', 'history', 'settings']