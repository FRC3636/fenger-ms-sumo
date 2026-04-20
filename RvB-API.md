# Fenger Management System (FMS) HTTP API

Base URL: `http://<fms-host>:8080`

All responses include `Access-Control-Allow-Origin: *`.

## GET `/scores`
Returns current match state as JSON.

**Response:**
```json
{
  "redScore": 0,
  "blueScore": 0,
  "redAutoScore": 0,
  "blueAutoScore": 0,
  "redPens": 0,
  "bluePens": 0,
  "matchRunning": false,
  "matchReady": true,
  "auto": false,
  "paused": false,
  "displayedPhase": "Controllers Down",
  "timeRemaining": 0,
  "redBlink": 0,
  "blueBlink": 0
}
```

## GET `/actions`
Returns `{"actions": [...]}` — the list of valid action names for `POST /action`.

## POST `/action`
Trigger a match/score action. Body: JSON `{"action": "<name>", "count": <int, optional, default 1>}`. `count` repeats the action (e.g. `{"action": "redScoreUp", "count": 3}` adds 3 to the red score). Max 100.

**Actions:**

| Action | Effect |
|---|---|
| `start` | If match stopped: start match in auto phase (15s → 5s pause → 135s teleop). If running: toggle pause. |
| `pause` | Alias of `start`; use this name when you intend to pause/resume. |
| `startTeleop` | Start match directly in teleop (135s, skips auto). |
| `clear` | Reset all scores, penalties, and match state. |
| `redScoreUp` / `redScoreDown` | Red total score ±1. |
| `blueScoreUp` / `blueScoreDown` | Blue total score ±1. |
| `redAutoUp` / `redAutoDown` | Red auto score ±2 (also adjusts total by ±2). |
| `blueAutoUp` / `blueAutoDown` | Blue auto score ±2 (also adjusts total by ±2). |
| `redPenaltyUp` / `redPenaltyDown` | Red penalty ±1. |
| `bluePenaltyUp` / `bluePenaltyDown` | Blue penalty ±1. |

**Responses:** `200 {"status":"ok","action":"<name>","count":<n>}` on success; `400` with `{"error":"...","validActions":[...]}` on bad input.

**Examples:**
```bash
curl -X POST http://fms:8080/action -d '{"action":"start"}'
curl -X POST http://fms:8080/action -d '{"action":"blueScoreUp","count":5}'
curl -X POST http://fms:8080/action -d '{"action":"clear"}'
curl http://fms:8080/scores
```

**Notes for LLM use:**
- Penalties *subtract* from the opposing alliance's effective score at match end (higher penalty = worse for that alliance).
- `auto` scoring adds to both the auto subtotal and the total — don't also call `redScoreUp` after `redAutoUp`.
- To set an exact score, first `clear`, then apply the needed `*Up`/`*Down` calls with `count`.
- The match phase auto-advances on a timer; you only need `start` once per match.
