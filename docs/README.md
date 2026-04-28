# Fenger Management System Documentation

Welcome to the Fenger Management System (FMS) documentation. This project is a web-based OBS overlay and admin panel for managing robotics competition matches.

## What is FMS?

FMS is a lightweight, single-server application built with [Bun](https://bun.sh) that provides:

- **Live overlays** for streaming software (OBS, etc.)
- **Admin control panel** for match operators
- **Spreadsheet integration** via Google Apps Script
- **Two game modes:** Sumo and Red vs Blue (RvB)

## Quick Links

- [**Setup Guide**](SETUP.md) — Install, configure, and run the server
- [**User Guide**](USAGE.md) — How to operate the admin panel and overlay
- [**API Reference**](API.md) — HTTP endpoints for developers
- [**Development Guide**](DEVELOPMENT.md) — How to modify and extend the code
- [**Architecture**](ARCHITECTURE.md) — How the system works under the hood

## Game Modes

### Sumo
A 1v1 match mode with a 2-minute timer. Features:
- Blue vs Red team display
- Countdown timer with urgent styling under 30 seconds
- Random arrow direction assignment on match load
- Winner banner overlay
- On-deck team preview
- Automatic result export to Google Sheets

### Red vs Blue (RvB)
A 2v2 alliance match mode with live scoring. Features:
- Blue Alliance (2 teams) vs Red Alliance (2 teams)
- Live score polling from an external scoring server
- Match phase tracking (Auto, Teleop, Pause)
- Score adjustment controls (total, auto, penalties)
- Automatic result export with full score breakdown

## Project Structure

```
.
├── index.ts          # Bun.serve() API server
├── handlers.ts       # State logic and type definitions
├── handlers.test.ts  # Unit tests for state handlers
├── admin.html        # Admin control panel UI
├── overlay.html      # Transparent OBS overlay UI
├── apps-script.gs    # Google Apps Script backend
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript config
└── docs/             # This documentation
```

## Getting Started

1. Install [Bun](https://bun.sh)
2. Run `bun install`
3. Run `bun --hot index.ts`
4. Open `http://localhost:3000` for the admin panel
5. Add `http://localhost:3000/overlay` as an OBS Browser Source

See [SETUP.md](SETUP.md) for detailed instructions.
