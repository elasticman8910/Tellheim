# Tellheim

A mobile-first, browser-based planet survival game. This first vertical slice contains a seeded Temperate map and tap-to-move exploration.

## Run locally

The project has no build step. Serve the repository root with any static server, then open it in a browser:

```bash
python3 -m http.server 8000
```

Visit <http://localhost:8000>. Tap a land tile to walk there; water tiles are avoided. Tap a
bright resource while standing on or next to it to mine it, and use **Inventory** to review
the collected items. Triple-tap the top-left corner to toggle Eruda.

GitHub Pages can publish the repository root directly.

Placeholder visuals are described in `assets/manifest.json` and generated at runtime. To
swap in real art later, change an entry to `{ "type": "image", "path": "assets/name.png" }`;
the game code does not need to change.
