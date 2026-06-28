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
