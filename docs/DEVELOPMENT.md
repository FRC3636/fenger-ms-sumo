# Development Guide

This guide is for developers who want to modify, extend, or debug the Fenger Management System.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh) (not Node.js)
- **Server:** `Bun.serve()` with flat route definitions
- **Language:** TypeScript (no transpilation needed — Bun runs `.ts` directly)
- **State:** In-memory JavaScript object (no database)
- **Tests:** `bun test` (Bun's built-in test runner)

## File Responsibilities

| File | Purpose |
|------|---------|
| `index.ts` | HTTP server, route handlers, Apps Script + RvB fetch logic |
| `handlers.ts` | Pure functions for state transitions (`applyStart`, `applyWinner`, etc.) |
| `handlers.test.ts` | Unit tests for the pure state functions |
| `admin.html` | Single-page admin UI (plain HTML + CSS + JS) |
| `overlay.html` | OBS overlay UI (plain HTML + CSS + JS) |
| `apps-script.gs` | Google Apps Script code (runs in Google's environment) |

## Running Tests

```bash
bun test
```

This runs all `*.test.ts` files using Bun's built-in test runner (Jest-compatible API).

## Hot Reload

During development, always use:

```bash
bun --hot index.ts
```

Bun watches imported files and restarts the server automatically. This works for:
- `index.ts`
- `handlers.ts`
- `admin.html`
- `overlay.html`

## State Management Philosophy

State transitions are kept **pure** in `handlers.ts`. The server in `index.ts`:

1. Receives a request
2. Calls a pure function from `handlers.ts` to compute the next state
3. Uses `Object.assign(state, result)` to mutate the in-memory state
4. Returns the updated state as JSON

This separation makes the business logic easy to test without spinning up a server.

### Example: Adding a New State Field

1. Add the field to the `State` interface in `handlers.ts`.
2. Add a default value in `index.ts` where `const state: State = { ... }` is initialized.
3. Update `applyStateUpdate` in `handlers.ts` to accept the new field.
4. Update the admin panel (`admin.html`) to display/edit the field.
5. Update the overlay (`overlay.html`) if it should be visible to viewers.
6. Add tests in `handlers.test.ts`.

## Adding a New API Route

Bun.serve's `routes` object uses flat paths. **Do not use deeply nested paths** like `/api/timer/start` — they don't work reliably.

```ts
Bun.serve({
  routes: {
    "/api/my-new-route": {
      GET: () => Response.json({ hello: "world" }),
    },
  },
});
```

## HTML Imports

Bun can import HTML files directly as strings:

```ts
import adminHtml from "./admin.html";
```

This is used to serve the admin panel and overlay. Bun handles bundling automatically — no build step required.

## Logging

The server uses colored console logging. Tags include:
- `[server]` — startup messages
- `[api]` — API request handling
- `[sheet]` — Google Apps Script interactions
- `[rvb]` — RvB scoring server interactions

## Common Modifications

### Change the Match Duration

Edit `MATCH_DURATION_MS` in `handlers.ts`:

```ts
export const MATCH_DURATION_MS = 2 * 60 * 1000; // 2 minutes
```

### Change the Default Port

Edit the `Bun.serve()` call in `index.ts`. Look for the port parameter (or add one):

```ts
Bun.serve({
  port: 8080,
  routes: { ... },
});
```

### Customize Overlay Styling

Edit the `<style>` blocks in `overlay.html`. The overlay uses transparent background and fixed-position elements.

### Add a New RvB Action

1. Add the action string to `RVB_ACTIONS` in `index.ts`.
2. The RvB scoring server must also support the same action name.
3. Add a button in `admin.html`.

## Debugging Tips

- **Check server logs:** All API calls and external fetches are logged with timestamps.
- **Test state logic in isolation:** Use `handlers.test.ts` or a small Bun script to test `applyStateUpdate` and friends.
- **Verify Apps Script:** Visit the Apps Script URL directly in a browser with `?token=fengermanagementsystem` appended.
- **Verify RvB server:** `curl http://<ip>:8080/scores` from the same machine running FMS.

## Code Style

- Use Bun APIs throughout (`Bun.serve`, `Bun.file`, `bun:sqlite` if needed)
- Prefer flat API routes
- Keep state transitions pure
- Use `const` by default
- Prefer `async/await` over raw Promises
