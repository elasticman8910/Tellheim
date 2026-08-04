import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TemperateMap } from './mapgen.js';

const items = JSON.parse(await readFile(new URL('../config/items.json', import.meta.url)));
const map = Object.create(TemperateMap.prototype);
map.items = items;
map.settings = { tileSize: 32, widthInTiles: 9, heightInTiles: 9 };
map.scene = null;
map.baseTiles = new Map();
map.resourceSprites = new Map();
map.tiles = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({
  terrain: 'terrainWater', resourceItemId: 'stone',
})));

map.placeLandingPod();
const { center, hullTiles, door, station, spawn } = map.landingPod;
assert.deepEqual(hullTiles, [
  center,
  { x: center.x - 1, y: center.y },
  { x: center.x + 1, y: center.y },
  { x: center.x, y: center.y - 1 },
], 'pod hull occupies the center and three arms');
assert.deepEqual(door, { x: center.x, y: center.y + 1 }, 'fourth arm is the door');
assert.equal(map.isWalkable(door.x, door.y), true, 'pod door is passable');
hullTiles.forEach(({ x, y }) => assert.equal(map.isWalkable(x, y), false, 'pod hull is solid'));
assert.equal(map.isWalkable(station.x, station.y), true, 'station marker is walkable');
assert.deepEqual(map.findWalkableStart(), spawn, 'player starts outside by the door');

[...hullTiles, door, station, spawn].forEach(({ x, y }) => {
  assert.equal(map.resourceAt(x, y), null, 'pod area and approach have no resources');
  assert.equal(map.tiles[y][x].terrain, 'terrainGrass', 'pod area and approach are walkable land');
});
[...hullTiles, door, station].forEach(({ x, y }) => {
  assert.equal(map.placeBase(x, y, 'wall'), false, 'pod fixtures cannot be built over');
});

console.log('Verified plus pod footprint, collision, station, spawn approach, and build protection.');
