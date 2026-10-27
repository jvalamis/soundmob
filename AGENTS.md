# AGENTS.md — soundmob

Worker satellite: landing, OAuth, session playback. Deploy: `wrangler deploy` → `soundmob.jvalamis.workers.dev`.

## Spatial layout (Tether)

Layout debug for hero panels migrates to **Tether** (hosted CF Worker) — **do not extend** `public/js/layout-debug.js`.

| Doc | Path |
|-----|------|
| Tether epic (READY) | [`ged/docs/plans/2026-06-28-tether-index.md`](../ged/docs/plans/2026-06-28-tether-index.md) |
| soundmob slice | Tether **Phase 4** — `tether-soundmob.js` adapter; delete monolith after parity |
| Canon | [`ged/docs/LAYOUT-DEBUG.md`](../ged/docs/LAYOUT-DEBUG.md) |

**Activation:** `?tether=1` + `tether-soundmob.js` → `https://tether.macrostrategies.ai/v1/client.js`.

Parent sessions: `git pull` in `ged` before plan ingress; cite `plan_path` on spatial slices.

## Git workflow (required for all agents and people)
1. At the start of a session, run `git fetch --prune`. Work on a fresh branch cut from the latest origin default branch (main/master), never on a stale branch.
2. One task per branch, named `<agent-or-jan>/<short-task>`. Never commit straight to main/master.
3. Finish by opening a PR into main/master, and delete the branch once it merges.
4. Before you end a session, push your branch, so nothing lives only on a local machine.
5. If the working copy is dirty or behind when you start, say so and ask. Don't overwrite, stash, reset or discard anything.
6. Never commit secrets.
