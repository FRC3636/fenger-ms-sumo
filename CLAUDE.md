# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OBS overlay + admin panel for a Sumo game. Run with `bun --hot index.ts`.

- `index.ts` — Bun.serve() API server with in-memory state
- `admin.html` — Control panel at `/` for setting match info and controlling the timer
- `overlay.html` — Transparent OBS Browser Source at `/overlay`, polls `/api/state` every second

### API routes

- `GET /api/state` — current state (match, team1, team2, timerEnd, arrows)
- `POST /api/state` — update match info (also randomizes arrow direction)
- `POST /api/start` — start 2-minute match timer, clears arrows
- `POST /api/end` — end match, increment match number, clear timer
- `POST /api/reset` — reset timer only (repeat match, no match number increment)
- `GET /api/sheet` — fetch last populated row from Google Sheet CSV and return `{ match, team1, team2 }`

### Google Sheet integration

`SHEET_CSV_URL` in `index.ts` points to a public CSV export. `fetchSheetRow()` parses the last non-blank row (non-empty `Match #` column). Column indices: 0 = Match #, 3 = Blue Team #1, 10 = Red Team #1. The "Load from Sheet" button in admin calls this endpoint and populates the fields — the user still presses "Set Match Info" to push values to the overlay.

### Color mapping

- team1 = Blue (left on overlay)
- team2 = Red (right on overlay)

### Routing caveat

Bun.serve `routes` has issues with deeply nested paths like `/api/timer/start`. Use flat paths like `/api/start` instead.

---

Default to using Bun instead of Node.js. Use `bun test` for tests, `bun install` for packages, `bunx` instead of `npx`. Bun automatically loads `.env`. Use `Bun.serve()` not express, `bun:sqlite` not better-sqlite3, `Bun.file` not `node:fs`. HTML files can be imported directly into `Bun.serve` routes — Bun bundles them automatically including `.tsx`/`.css` imports.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
