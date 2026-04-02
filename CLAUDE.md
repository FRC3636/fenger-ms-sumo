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
- `GET /api/sheet` — fetch current match row from Google Sheet CSV, returns `{ match, team1, team2, team1Name, team2Name, team1Members, team2Members }`
- `POST /api/ondeck` — fetch on-deck teams from the on-deck sheet, updates `state.ondeck1`/`ondeck2`, returns `{ ondeck1, ondeck1Name, ondeck2, ondeck2Name }`

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

## Google Sheet integration

Two sheets, both fetched with `cache: "no-store"` and a `&t=Date.now()-${Math.random()}` cache-buster to avoid Google's CDN caching across edge nodes.

**Match sheet** (`SHEET_CSV_URL`, gid=1317889012): `GET /api/sheet` fetches **twice in parallel** and returns whichever result has the higher match number — this defends against stale responses from different Google edge servers. `fetchSheetRow()` picks the row with the highest Match # value (not last-by-position). Column indices: 0 = Match #, 3 = Blue Team #1, 4 = Blue Members, 5 = Robot Name (Blue), 10 = Red Team #1, 11 = Red Members, 12 = Robot Name (Red).

**On-deck sheet** (`ONDECK_CSV_URL`, gid=1738939427): sorted list of teams waiting to play. `fetchOnDeckRows()` reads the first two data rows — row 1 = Red on-deck (`ondeck2`), row 2 = Blue on-deck (`ondeck1`). Column indices: 4 = Team #, 5 = Robot Name.

The "Load from Sheet" button retries up to 8 times (2 s apart) until the sheet returns a match number higher than the current one, then auto-saves to the overlay. If all retries fail it shows an error. No separate "Set Match Info" press is needed after a successful load.

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
