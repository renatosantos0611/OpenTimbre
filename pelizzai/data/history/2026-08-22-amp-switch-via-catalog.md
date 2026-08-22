# Task history — amp-switch-via-catalog

- slug: amp-switch-via-catalog
- track: bug
- lane: n/a
- phase: delivered
- branch: fix/amp-switch
- base-ref: refs/heads/main
- base-sha: 058fba6 (main before the fix)
- validated-head: 6896dd412cfd609eb021545ee4e0e8fbdc4d93b4
- delivery-head: <closure-head>
- delivery-status: pr-open (pending)
- confirm: base-ref contains validated-head (PR/branch integrated)
- kickoff: ratified 2026-08-22 — bug track (apply never switches amp on any archetype; amp
  knobs dead, pedals work). Interview-me decision: amp strategy becomes catalog data
  (`ampStrategy` required on PluginSpec), `continuous` declared for the four shipping
  archetypes (graded ampSelect values + selector CC in the mapping XMLs); `manual` stays the
  conscious default for unprobed selectors. Root cause confirmed by code reading:
  scene-applier called getAmpStrategy(spec) with no name and the function defaulted to
  'manual' (no MIDI); legacy read AMP_STRATEGY/GOJIRA_AMP_STRATEGY env vars that the port
  deliberately dropped without replacement, so the plugin stayed on the current amp and the
  amp knob CCs landed on the wrong amp page.
- isolation: branch
- worktree-path: <none>
- execution-mode: inline
- commit-strategy: granular
- review-profile: split
- effect: write-local
- risk: medium
- overlays: opentimbre-plugin-spec, opentimbre-testing, opentimbre-code-style,
  opentimbre-core-boundary
- audience: technical
- spec: <none — bug track>
- plan: <none — bug track>
- project: /workspace/OpenTimbre

## Progress

- BUG amp-switch-via-catalog: ampStrategy added as required PluginSpec data; gojira, soldano,
  tim-henson, petrucci declare 'continuous'; getAmpStrategy resolves explicit name else the
  catalog declaration; selector CC now precedes the scene plan on the resolved amp (including
  the unmapped fallback). Review (independent, quality lens) → 2 Important (comment overstated
  probe evidence for unprobed selectors — softened; fallback path lacked wire-level assertion —
  added) + 1 Minor (ccsSent contract comment clarified), all applied. Sealed at 6896dd4;
  lint exit 0, full check exit 0 (i18n 4, core 240, platform-node 29, cli 11, desktop-main 86).
  Follow-up noted by review: Petrucci/Tim Henson selector values are hypotheses pending the
  Phase 0 probe ritual on hardware (their mapping XMLs say so); Tim Henson's rhythmChannel
  (CC 29) is not modeled.
