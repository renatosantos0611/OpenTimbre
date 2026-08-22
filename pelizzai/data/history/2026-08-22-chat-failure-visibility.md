# Task history — chat-failure-visibility

- slug: chat-failure-visibility
- track: bug
- lane: n/a
- phase: delivered
- branch: fix/chat-api-errors
- base-ref: refs/heads/main
- base-sha: 3a6f1f3a731ed705506dd3296dc83232573dfca6
- validated-head: 9f50653f9a17f41c299ae225071f5acfb88baabf
- delivery-head: <closure-head recorded below>
- delivery-status: pr-open (pending, recorded after the PR)
- confirm: base-ref contains validated-head (PR/branch integrated)
- kickoff: ratified 2026-08-22 — bug track (chat: GPT turns fail with a misleading "check your
  connection/key" message even with a correct OpenAI key; AI returns missing parameters and the
  turn dies without building the message). Interview-me decisions: (1) categorized friendly i18n
  errors per failure kind, raw API text never surfaces; (2) truncated responses (OpenAI
  `incomplete` / Anthropic `max_tokens`) throw a categorized error, and Anthropic's MAX_OUTPUT
  rises 16k→32k (a ceiling, not a cost). Root causes confirmed by code reading: chat-controller
  maps every send error to one generic message and hides the cause (plus leftover [DEBUG-chatsend]
  instrumentation); providers do not classify SDK errors nor detect output truncation, so a
  mid-tool token ceiling cut surfaces as "arguments aren't valid JSON" or empty prose.
- isolation: branch
- worktree-path: <none>
- execution-mode: inline
- commit-strategy: granular
- review-profile: split
- effect: write-local
- risk: medium
- overlays: opentimbre-i18n, opentimbre-secrets, opentimbre-testing, opentimbre-code-style
- audience: technical
- spec: <none — bug track>
- plan: <none — bug track>
- project: /workspace/OpenTimbre

## Progress

- BUG chat-failure-visibility (this task): root cause — chat-controller mapped EVERY send
  failure to one generic "check your connection and API key" message (with leftover
  `[DEBUG-chatsend]` logs the only trace), and neither provider detected output-token
  truncation, so a mid-tool ceiling cut surfaced as garbled args or empty prose. Fix: a
  categorized `TurnError` in the shared tool-use protocol (providers map SDK errors +
  truncation signals to it; OpenAI content-filter cutoff as its own `blocked` kind);
  chat-controller localizes each kind via new en/pt catalog entries and logs only the kind;
  Anthropic output ceiling 16k→32k. Review (independent, quality lens) → 1 Important
  (content_filter mislabeled as truncation) + minors, all applied and re-verified. Sealed at
  b9ea70b (core) + 9f50653 (desktop+i18n); validated-head 9f50653 — lint exit 0, full check
  exit 0 (i18n 4, core 235, platform-node 29, cli 11, desktop-main 86, renderer 10 files).
  Note: the nanoid audit-fix lockfile change was committed separately on fix/deps-nanoid-audit
  (17e8f76) to keep this task's diff clean.
