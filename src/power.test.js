import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DayNightCycle } from './daynight.js';
import { PowerGrid } from './power.js';

const balance = JSON.parse(await readFile(new URL('../config/balance.json', import.meta.url)));

function makeGrid() {
  const cycle = new DayNightCycle(null, balance.dayNight);
  const grid = new PowerGrid(cycle, balance.power);
  grid.registerConsumer('lifeSupport', balance.power.consumerDrawPerSecond.lifeSupport);
  grid.registerConsumer('suitRack', balance.power.consumerDrawPerSecond.suitRack);
  return { cycle, grid };
}

const daytime = makeGrid();
const dayStart = daytime.grid.battery;
daytime.grid.update(10);
assert.ok(daytime.grid.battery > dayStart, 'surplus solar generation charges the battery by day');

const nighttime = makeGrid();
nighttime.cycle.update(balance.dayNight.dayDurationSeconds + balance.dayNight.duskDurationSeconds);
assert.equal(nighttime.cycle.phase, 'night');
assert.equal(nighttime.grid.generationPerSecond(), 0, 'solar generation is zero at night');
const nightStart = nighttime.grid.battery;
nighttime.grid.update(10);
assert.ok(nighttime.grid.battery < nightStart, 'registered consumers drain the battery at night');

console.log('Verified daytime charging, nighttime drain, and zero nighttime generation.');
