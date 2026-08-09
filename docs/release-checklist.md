# OpenTimbre release checklist

Manual release validation for the Windows desktop app. Automation
(`.github/workflows/release.yml`) proves build, tests, and packaged boot;
this checklist covers what automation cannot: installer UX, plugin host
operation, uninstall, and the update round-trip.

Builds are unsigned: the SmartScreen "Run anyway" step is an accepted risk
and part of the expected flow below.

## Record

| Field | Value |
| --- | --- |
| Date | |
| Version under test (e.g. 0.2.0) | |
| Run by | |
| Windows profile used | |

## 1. Fresh install on a clean Windows profile

Use a profile that never had OpenTimbre installed, with loopMIDI present.

- [ ] Download the installer asset from the tag's GitHub Release.
- [ ] Run it. SmartScreen warning appears → **More info** → **Run anyway**.
- [ ] No UAC elevation prompt appears; the installer proceeds per-user.
- [ ] The installer offers a directory choice; accept the default or pick
      another folder.
- [ ] Launch the app from the created shortcut. The window opens.

## 2. Packaged app smoke

- [ ] The app opens without errors.
- [ ] The chat pane renders (composer visible, no blank pane).
- [ ] Settings opens; the API-key form works.

## 3. Plugin host on the packaged runtime

- [ ] Start a loopMIDI port on Windows.
- [ ] Start a supported Neural DSP plugin host.
- [ ] From the app, open the plugin: the app detects the running host and
      MIDI output reaches the created port (no crash, no missing-binding
      error from the packaged runtime).

## 4. Uninstall

- [ ] Uninstall OpenTimbre from Windows settings.
- [ ] The app, its shortcuts, and the install directory are removed.
- [ ] User data (settings, API keys, history under the user's OpenTimbre
      data folder) remains behind. This is acceptable and expected; the
      uninstaller does not delete user data.

## 5. Update round-trip between two published versions

Requires two published releases, X and X+1.

- [ ] Publish X: bump `packages/desktop/package.json` to X, update
      `CHANGELOG.md`, commit, `git tag vX`, `git push origin vX`; Actions
      publishes the artifacts and `latest.yml`.
- [ ] Install X from the release and launch it. No update banner appears.
- [ ] Publish X+1 the same way.
- [ ] Restart the installed app; on startup the banner shows version X+1.
- [ ] Confirm the download; progress is shown; it completes.
- [ ] Confirm the restart; the app restarts and runs version X+1
      (status-bar version confirms it).

## 6. Rollback

Downgrades are not supported. Rolling back a bad release means publishing a
newer tag with the fix; installed users move forward to it through the same
update banner flow.
