# fenger-ms-sumo

Supports two game modes in one admin/overlay app:
- **Sumo** (match timer + winner + Apps Script sheet integration)
- **Red vs Blue (RvB)** (2 blue teams vs 2 red teams with live scoring via external server on port `8080`)

To install dependencies:

```bash
bun install
```

To run (for development):

```bash
bun run index.ts
```

To build:
```bash
bun build --compile index.ts --target=bun-windows-x64-modern --outfile sumo
```
