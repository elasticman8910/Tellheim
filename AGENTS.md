PROJECT SPEC — “Tellheim” (working title)
A mobile-first 2D planet-survival and exploration game. Played in the browser (phone-first). Built with Phaser 3, deployed via GitHub Pages. Read this file at the start of every task. Do not implement anything listed under OUT OF SCOPE.
V1 SCOPE (the whole game, nothing more)
• One star system, 3 planets, each a different biome archetype: a. Temperate (starting planet) — mild temperature, breathable pockets, basic resources
b. Frozen — cold damage outside heated zones, has a resource the Temperate planet lacks
c. Scorched — heat damage, has the final resource tier
• Procedurally generated tile maps per planet (seeded, so a planet regenerates the same way).
• Survival meters: Oxygen (drains outdoors, refills inside a sealed base) and Temperature (harmed outside safe range; base insulation and heaters matter).
• Mining: tap a resource tile to mine it into inventory. •
Crafting: menu-driven. Recipes gate progression (tools → base parts → 1 extractor → rocket parts).
• Base building: place wall, floor, door/airlock, heater, oxygen generator tiles. A sealed room= safe zone. Base LAYOUT matters (sealed vs leaking).
• One automation item: the Extractor — place it on a resource tile, it mines slowly while
you do other things. Unlocked only after the player has mined that resource type manually at
least once.
• Win condition: craft the rocket (requires resources from all 3 planets) and launch.
• Planet travel: rocket travel = load the next planet’s map. No flight simulation.
OUT OF SCOPE for v1 (do not build, even if it seems
easy)
• More planets, more star systems
•
Logistics/delivery chains, schedules, vehicles
•
Decorative/aesthetic building items and beauty buffs
• NPCs, crew, combat, creatures
•
Multiplayer, saves in the cloud (localStorage save is fine)
• Sound/music (stub a mute audio manager, fill later)
TECH & DEPLOYMENT
• Phaser 3 (latest stable), plain JavaScript (no TypeScript, no build step if avoidable — keep it
runnable as static files).
• Deploy target: GitHub Pages. The game must run by opening index.html from the reporoot (or /docs if Pages requires it).
• Mobile browser is the primary device. Test target: Chrome/Safari on a phone.
•
Include Eruda debug console, toggled by triple-tapping the top-left corner. Log errors and
key game events to it.
MOBILE & CONTROLS
•
Portrait orientation, one-handed play.
• Tap-to-move (pathfind to tapped tile), tap a resource tile when adjacent to mine,
tap-and-hold to open the context/build menu on a tile.
•
All UI touch targets minimum 44px. Crafting and inventory are full-screen overlays, thumb-
reachable buttons at the bottom.
• HUD: oxygen bar, temperature indicator, inventory button, craft button. Keep it minimal.
ART & ASSET CONVENTIONS (critical — do not
violate)
•
All visuals are placeholders for now: flat-colored 32×32 tiles and simple shapes. NO
detailed drawing in code.
• Every sprite/tile loads from /assets/ by filename defined in a single manifest file
(assets/manifest.json). Never hardcode graphics inline. Real art will be swapped in later
by replacing files only.
•
•
Tile size: 32×32px. Character sprite: 32×48px. Stick to this grid everywhere.
Placeholder color key: terrain = muted earth tones per biome, resources = saturated bright
colors, base parts = grays/blues, hazards = red tint.CODE CONVENTIONS
•
Small files, one system per file: player.js, mining.js, oxygen.js, temperature.js,
crafting.js, building.js, mapgen.js, extractor.js, ui.js.
•
All tunable numbers (drain rates, recipe costs, mining speed, damage) live in
config/balance.json — never scattered as magic numbers. The developer will tune
balance by editing this file only.
•
Recipes and items defined in config/items.json (id, name, spriteKey, recipe).
• Comment code for a non-programmer reader: brief plain-English notes on what each system
does.
WORKFLOW RULES
• One feature per task/PR. Do not bundle systems.
•
Every PR must leave the game in a runnable, playable state.
•
If a task is ambiguous, choose the simplest interpretation and note the decision in the PR
description.
BUILD ORDER (vertical slice)
1. Project skeleton: Phaser boots, generated tile map from seed, player tap-to-move, Eruda
console, deployed on Pages
2. Mining → inventory (with inventory UI)3. Crafting menu + items.json + first recipes (tools) 4. Oxygen system + base tiles + sealed-room detection 5. Temperature system + heaters + biome hazards 6. Extractor (unlock rule: manual-mine first) 7. Second and third planets + rocket + travel + win screen 8. localStorage save/load 9. Balance pass via balance.json
When the build order is complete, v1 is DONE. Stop and await new instructions.