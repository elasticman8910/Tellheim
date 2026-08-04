import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DayNightCycle } from './daynight.js';
import { OxygenSystem } from './oxygen.js';
import { PowerGrid } from './power.js';
import { TemperatureSystem } from './temperature.js';

const balance = JSON.parse(await readFile(new URL('../config/balance.json', import.meta.url)));

function makeWorld({ heated = false, byRack = false } = {}) {
  const size = 7;
  const baseTiles = new Map();
  for (let coordinate = 1; coordinate <= 5; coordinate += 1) {
    baseTiles.set(`${coordinate},1`, { itemId: 'wall' });
    baseTiles.set(`${coordinate},5`, { itemId: 'wall' });
    baseTiles.set(`1,${coordinate}`, { itemId: 'wall' });
    baseTiles.set(`5,${coordinate}`, { itemId: 'wall' });
  }
  if (heated) baseTiles.set('2,2', { itemId: 'heater' });
  const map = {
    settings: { tileSize: 32, widthInTiles: size, heightInTiles: size },
    tiles: Array.from({ length: size }, () => Array.from({ length: size }, () => ({}))),
    baseTiles,
    baseAt(x, y) { return this.baseTiles.get(`${x},${y}`)?.itemId || null; },
    isPodHull() { return false; }, isPodDoor() { return false; }, podObjectAt() { return null; },
    isAdjacentToSuitRack() { return byRack; },
  };
  const player = {
    tile: { x: 3, y: 3 }, settings: balance.player,
    currentTile() { return this.tile; }, respawn() {}, sprite: { setTexture() {} },
  };
  const oxygen = new OxygenSystem(null, map, player, balance.oxygen);
  const cycle = new DayNightCycle(null, balance.dayNight);
  const power = new PowerGrid(cycle, balance.power);
  const temperature = new TemperatureSystem(
    map, player, cycle, power, oxygen, balance.temperature,
    balance.power.consumerDrawPerSecond,
  );
  return { oxygen, cycle, power, temperature };
}

const exposed = makeWorld();
exposed.cycle.update(balance.dayNight.dayDurationSeconds + balance.dayNight.duskDurationSeconds);
const fullSuit = exposed.temperature.suitPower;
exposed.temperature.update(1);
assert.ok(exposed.temperature.ambientTemperature < balance.temperature.safeMinimumCelsius,
  'night ambient falls below the safe range');
assert.equal(exposed.temperature.suitPower,
  fullSuit - balance.temperature.suitHeaterDrainPerSecond,
  'the suit heater drains power during cold exposure');

exposed.temperature.suitPower = 0;
const fullHealth = exposed.oxygen.health;
exposed.temperature.update(1);
assert.equal(exposed.oxygen.health, fullHealth - balance.temperature.coldHealthDrainPerSecond,
  'cold exposure drains HP once suit power is empty');

const rack = makeWorld({ byRack: true });
rack.cycle.update(balance.dayNight.dayDurationSeconds + balance.dayNight.duskDurationSeconds);
rack.temperature.suitPower = 25;
rack.temperature.update(1);
assert.equal(rack.temperature.suitPower,
  25 + balance.temperature.suitRackRechargePerSecond - balance.temperature.suitHeaterDrainPerSecond,
  'the powered Suit Rack recharges before the exposed suit heater draw');
assert.equal(rack.power.consumers.has('suitRack'), true, 'Suit Rack draw is registered while charging');

const warm = makeWorld({ heated: true });
warm.cycle.update(balance.dayNight.dayDurationSeconds + balance.dayNight.duskDurationSeconds);
const warmPower = warm.temperature.suitPower;
warm.temperature.update(1);
assert.equal(warm.temperature.suitPower, warmPower, 'a powered heated sealed room stops suit drain');
assert.equal(warm.power.consumers.has('heater:2,2'), true, 'placed heater is a grid consumer');

const unheated = makeWorld();
unheated.cycle.update(balance.dayNight.dayDurationSeconds + balance.dayNight.duskDurationSeconds);
const unheatedPower = unheated.temperature.suitPower;
unheated.temperature.update(1);
assert.ok(unheated.temperature.suitPower < unheatedPower,
  'an unheated sealed room remains at ambient and does not protect the suit');

console.log('Verified ambient cold, suit drain, cold damage, rack recharge, and heated/unheated rooms.');
