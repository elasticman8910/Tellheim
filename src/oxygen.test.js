import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OxygenSystem } from './oxygen.js';
import { TemperateMap } from './mapgen.js';

const items = JSON.parse(await readFile(new URL('../config/items.json', import.meta.url)));
const balance = JSON.parse(await readFile(new URL('../config/balance.json', import.meta.url)));

function testWorld() {
  const map = Object.create(TemperateMap.prototype);
  map.items = items;
  map.settings = { tileSize: 32, widthInTiles: 7, heightInTiles: 7 };
  map.scene = null;
  map.baseTiles = new Map();
  map.tiles = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => ({
    terrain: 'terrainGrass', resourceItemId: null,
  })));
  map.landingPod = { x: 1, y: 1 };
  const player = {
    tile: { x: 3, y: 3 }, settings: balance.player,
    currentTile() { return this.tile; }, respawn() { this.tile = { ...map.landingPod }; },
    sprite: { setTexture() {} },
  };
  return { map, player };
}

const { map, player } = testWorld();
// Enclose a 3×3 interior with a one-tile-thick wall perimeter.
for (let coordinate = 1; coordinate <= 5; coordinate += 1) {
  map.baseTiles.set(`${coordinate},1`, { itemId: 'wall' });
  map.baseTiles.set(`${coordinate},5`, { itemId: 'wall' });
  map.baseTiles.set(`1,${coordinate}`, { itemId: 'wall' });
  map.baseTiles.set(`5,${coordinate}`, { itemId: 'wall' });
}
const oxygen = new OxygenSystem(null, map, player, balance.oxygen);
assert.equal(oxygen.regions.length, 1, 'closed room is sealed');
assert.equal(oxygen.regions[0].tiles.length, 9, 'sealed room has a 3×3 interior');

map.removeBase(3, 1);
oxygen.recompute({ action: 'remove', itemId: 'wall' });
assert.equal(oxygen.regions.length, 0, 'wall removal immediately unseals room');

map.baseTiles.set('3,1', { itemId: 'door' });
map.baseTiles.set('3,3', { itemId: 'oxygenGenerator' });
oxygen.recompute({ action: 'place', itemId: 'oxygenGenerator' });
assert.equal(oxygen.regions[0].hasGenerator, true, 'passable door still seals the room');
oxygen.oxygen = 100;
oxygen.update(1);
assert.equal(oxygen.oxygen, 100 + balance.oxygen.refillPerSecond, 'generator refills sealed room');

player.tile = { x: 1, y: 0 };
oxygen.oxygen = 100;
oxygen.update(1);
assert.equal(oxygen.oxygen, 100 + balance.oxygen.refillPerSecond, 'pod adjacency refills oxygen');

console.log('Verified sealing, breach, sealed generator refill, and pod refill.');
