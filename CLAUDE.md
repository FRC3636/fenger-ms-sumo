# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OBS overlay + admin panel for a Sumo game. Run with `bun --hot index.ts`.

- `index.ts` — Bun.serve() API server with in-memory state
- `admin.html` — Control panel at `/` for setting match info and controlling the timer
- `overlay.html` — Transparent OBS Browser Source at `/overlay`, polls `/api/state` every second

## Running

```
bun --hot index.ts
```

No build step. Bun bundles HTML files (including any `.tsx`/`.css` imports) automatically at serve time.

## API routes

- `GET /api/state` — full state object
- `POST /api/state` — update match/team fields; also randomizes arrow direction and clears winner
- `POST /api/start` — start 2-minute match timer, clears arrows and winner
- `POST /api/end` — end match, clear timer and winner
- `POST /api/reset` — reset timer only (repeat match, no state changes)
- `POST /api/winner` — set `{ winner: "team1" | "team2" }`, stops timer
- `GET /api/sheet` — fetch from Apps Script, returns `{ match, team1, team2, team1Name, team2Name, team1Members, team2Members, ondeck1, ondeck2 }`

## State shape

```ts
{
  match: number;
  team1: number;        // Blue team number
  team2: number;        // Red team number
  team1Name: string;    // Blue robot name
  team2Name: string;    // Red robot name
  timerEnd: number | null;   // epoch ms when timer expires
  arrows: "up-down" | "down-up" | null;
  winner: "team1" | "team2" | null;
  ondeck1: number | null;    // Blue on-deck team number
  ondeck2: number | null;    // Red on-deck team number
}
```

## Google Apps Script integration

All sheet data is fetched from a single Google Apps Script endpoint (`APPS_SCRIPT_URL`) with a `token=fengermanagementsystem` query param. The script returns JSON with both match and on-deck data.

Response shape:
```json
{ "matchNumber", "blueTeamNumber", "redTeamNumber", "blueTeamName", "redTeamName", "blueTeamMembers", "redTeamMembers", "blueOnDeck", "redOnDeck" }
```

`fetchAppsScript()` fetches once and returns the parsed response. `fetchSheetRow()` and `fetchOnDeckRows()` both delegate to it. The "Load from Sheet" button does a single fetch, auto-saves to the overlay, and also fetches on-deck. No retry logic — the Apps Script serves fresh data directly.

## Color mapping

- `team1` = Blue (left side of overlay)
- `team2` = Red (right side of overlay)

## Overlay layout

Team boxes are wrapped in `.team1-wrapper` / `.team2-wrapper` (fixed-positioned flex columns). The on-deck label sits above the team box inside the wrapper and is shown/hidden via the `.visible` class based on `state.ondeck1`/`ondeck2` being non-null. When `state.winner` is set, the match badge, timer, arrows, and both team wrappers are all hidden — only the winner banner is shown.

## Routing caveat

Bun.serve `routes` has issues with deeply nested paths like `/api/timer/start`. Use flat paths like `/api/start` instead.

---

Use Bun APIs throughout: `Bun.serve()` not express, `bun:sqlite` not better-sqlite3, `Bun.file` not `node:fs`. Bun automatically loads `.env`. Use `bun install` / `bunx` / `bun test`.

Bun API docs are in `node_modules/bun-types/docs/**.mdx`.
