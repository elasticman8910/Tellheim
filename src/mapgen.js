import { AssetRegistry } from './assets.js';

// Builds the same Temperate landscape every time from the configured text seed.
export class TemperateMap {
  constructor(scene, settings, items, resourceSettings = {}) {
    this.scene = scene;
    this.settings = settings;
    this.items = items;
    this.resourceSettings = resourceSettings;
    this.tiles = [];
    this.resourceSprites = new Map();
    this.baseTiles = new Map();
    this.landingPod = null;
  }

  create() {
    const { widthInTiles, heightInTiles, tileSize, seed } = this.settings;
    const random = new Phaser.Math.RandomDataGenerator([seed]);
    // This allowlist is shared by tile selection and sprite lookup, keeping the
    // visible resource type tied to the exact item id mining will return.
    const resourceIds = Object.values(this.items)
      .filter((item) => item.mineable === true)
      .map((item) => item.id);

    for (let y = 0; y < heightInTiles; y += 1) {
      const row = [];
      for (let x = 0; x < widthInTiles; x += 1) {
        // Averaging nearby random samples produces broad, natural-looking patches.
        const value = (random.frac() + random.frac() + random.frac()) / 3;
        const type = value >= this.settings.waterThreshold
          ? 'terrainWater'
          : value >= this.settings.soilThreshold ? 'terrainSoil' : 'terrainGrass';
        const canHoldResource = type !== 'terrainWater';
        const resource = canHoldResource && random.frac() < this.settings.resourceSpawnChance
          ? resourceIds[random.integerInRange(0, resourceIds.length - 1)]
          : null;
        // The tile owns the reward id. Its texture is presentation only and is
        // never consulted when the tile is mined.
        const range = this.resourceSettings[resource]?.yieldRange || [1, 1];
        const yieldTotal = resource ? random.integerInRange(range[0], range[1]) : 0;
        row.push({
          terrain: type, resourceItemId: resource, remainingYield: yieldTotal,
          totalYield: yieldTotal, regrowAt: null,
        });
        this.scene.add.image(
          x * tileSize + tileSize / 2,
          y * tileSize + tileSize / 2,
          type,
        );
        if (resource) {
          const resourceSprite = this.scene.add.image(
            x * tileSize + tileSize / 2,
            y * tileSize + tileSize / 2,
            this.textureForItem(resource, `resource ${resource} at ${x},${y}`),
          ).setDepth(1);
          this.resourceSprites.set(`${x},${y}`, resourceSprite);
        }
      }
      this.tiles.push(row);
      row.forEach((tile, x) => { if (tile.resourceItemId) this.updateResourceAppearance(x, y); });
    }

    this.scene.physics.world.setBounds(0, 0, widthInTiles * tileSize, heightInTiles * tileSize);
    this.scene.cameras.main.setBounds(0, 0, widthInTiles * tileSize, heightInTiles * tileSize);
    this.placeLandingPod();
  }

  // The pod is a cornerless 5x5 ring surrounding a 3x3 floor. Its south door
  // is the only route into the walkable plus between the four solid stations.
  placeLandingPod() {
    const center = this.findPodCenter();
    const door = { x: center.x, y: center.y + 2 };
    const hullTiles = [];
    for (let offset = -1; offset <= 1; offset += 1) {
      hullTiles.push({ x: center.x + offset, y: center.y - 2 });
      if (offset !== 0) hullTiles.push({ x: center.x + offset, y: center.y + 2 });
      hullTiles.push({ x: center.x - 2, y: center.y + offset });
      hullTiles.push({ x: center.x + 2, y: center.y + offset });
    }
    const floorTiles = [];
    for (let y = center.y - 1; y <= center.y + 1; y += 1) {
      for (let x = center.x - 1; x <= center.x + 1; x += 1) floorTiles.push({ x, y });
    }
    const objects = [
      { id: 'suitRack', name: 'Suit Rack', texture: 'podSuitRack', x: center.x - 1, y: center.y + 1 },
      { id: 'thermalControl', name: 'Thermal Control', texture: 'podThermalControl', x: center.x - 1, y: center.y - 1 },
      { id: 'highCapacityBattery', name: 'High-Capacity Battery', texture: 'podBattery', x: center.x + 1, y: center.y - 1 },
      { id: 'lifeSupport', name: 'Life Support', texture: 'podLifeSupport', x: center.x + 1, y: center.y + 1 },
    ];
    const spawn = { x: center.x, y: center.y + 3 };
    this.landingPod = { center, hullTiles, door, floorTiles, objects, spawn };
    const emptyCorners = [
      { x: center.x - 2, y: center.y - 2 }, { x: center.x + 2, y: center.y - 2 },
      { x: center.x - 2, y: center.y + 2 }, { x: center.x + 2, y: center.y + 2 },
    ];

    // Flatten the complete footprint and door approach so every seed starts safely.
    [...hullTiles, door, ...floorTiles, ...objects, ...emptyCorners, spawn].forEach(({ x, y }) => {
      this.removeResource(x, y);
      this.removeBase(x, y);
      this.tiles[y][x].terrain = 'terrainGrass';
      this.scene?.add?.image(
        x * this.settings.tileSize + this.settings.tileSize / 2,
        y * this.settings.tileSize + this.settings.tileSize / 2,
        'terrainGrass',
      );
    });
    const size = this.settings.tileSize;
    floorTiles.forEach(({ x, y }) => this.addPodSprite(x, y, 'podFloor', size));
    hullTiles.forEach(({ x, y }) => this.addPodSprite(x, y, 'landingPodHull', size));
    this.addPodSprite(door.x, door.y, 'landingPodDoor', size);
    objects.forEach((object) => {
      object.sprite = this.addPodSprite(object.x, object.y, object.texture, size);
      console.log(`Landing pod station: ${object.name} at (${object.x}, ${object.y})`);
    });
  }

  addPodSprite(x, y, texture, size) {
    return this.scene?.add?.image(x * size + size / 2, y * size + size / 2, AssetRegistry.resolveTextureKey(this.scene, texture, `pod ${texture} at ${x},${y}`))?.setDepth(1);
  }

  isPodHull(x, y) {
    return this.landingPod?.hullTiles.some((tile) => tile.x === x && tile.y === y) || false;
  }

  isPodDoor(x, y) {
    return this.landingPod?.door.x === x && this.landingPod?.door.y === y;
  }

  podObjectAt(x, y) {
    return this.landingPod?.objects.find((object) => object.x === x && object.y === y) || null;
  }

  isAdjacentToSuitRack(x, y) {
    const rack = this.landingPod?.objects.find((object) => object.id === 'suitRack');
    return Boolean(rack) && Math.abs(rack.x - x) + Math.abs(rack.y - y) === 1;
  }

  isLandingPod(x, y) {
    return this.isPodHull(x, y) || this.isPodDoor(x, y) || Boolean(this.podObjectAt(x, y))
      || this.landingPod?.floorTiles.some((tile) => tile.x === x && tile.y === y) || false;
  }

  isWalkable(x, y) {
    const baseItemId = this.baseAt(x, y);
    return Boolean(this.tiles[y]?.[x]) && this.tiles[y][x].terrain !== 'terrainWater'
      && !this.isPodHull(x, y) && !this.podObjectAt(x, y)
      && !this.items[baseItemId]?.blocksMovement;
  }

  baseAt(x, y) {
    return this.baseTiles.get(`${x},${y}`)?.itemId || null;
  }

  setBasePowered(x, y, powered) {
    this.baseTiles.get(`${x},${y}`)?.sprite?.setAlpha?.(powered ? 1 : 0.35);
  }

  setPodObjectPowered(id, powered) {
    this.landingPod?.objects.find((object) => object.id === id)?.sprite?.setAlpha?.(powered ? 1 : 0.35);
  }

  // Base parts use a separate layer, leaving seeded terrain unchanged underneath.
  placeBase(x, y, itemId) {
    const key = `${x},${y}`;
    const item = this.items[itemId];
    if (!item?.placeable || !this.tiles[y]?.[x] || this.tiles[y][x].terrain === 'terrainWater'
      || this.resourceAt(x, y) || this.baseTiles.has(key) || this.isLandingPod(x, y)) return false;
    const size = this.settings?.tileSize || 32;
    const sprite = this.scene?.add?.image
      ? this.scene.add.image(x * size + size / 2, y * size + size / 2, this.textureForItem(itemId, `structure ${itemId} at ${x},${y}`)).setDepth(1)
      : null;
    this.baseTiles.set(key, { itemId, sprite });
    return true;
  }

  removeBase(x, y) {
    const key = `${x},${y}`;
    const placed = this.baseTiles.get(key);
    if (!placed) return null;
    placed.sprite?.destroy();
    this.baseTiles.delete(key);
    return placed.itemId;
  }

  resourceAt(x, y) {
    const tile = this.tiles[y]?.[x];
    const itemId = tile?.resourceItemId;
    return itemId && (tile.remainingYield ?? 1) > 0 && this.items[itemId]?.mineable === true ? itemId : null;
  }

  resourceNodeAt(x, y) {
    const tile = this.tiles[y]?.[x];
    return tile?.resourceItemId ? tile : null;
  }

  // A mining action removes one unit. Plants remain as dim stubs until their timer expires.
  mineResourceUnit(x, y, now = Date.now()) {
    const tile = this.tiles[y]?.[x];
    const itemId = tile?.resourceItemId;
    if (!itemId || (tile.remainingYield ?? 1) <= 0 || this.items[itemId]?.mineable !== true) return null;
    tile.remainingYield ??= 1;
    tile.totalYield ??= tile.remainingYield;
    tile.remainingYield -= 1;
    if (tile.remainingYield > 0) {
      this.updateResourceAppearance(x, y);
      return itemId;
    }
    const regrowDelay = this.resourceSettings?.[itemId]?.regrowMilliseconds;
    if (this.items[itemId].resourceKind === 'plant' && Number.isFinite(regrowDelay)) {
      tile.regrowAt = now + regrowDelay;
      this.updateResourceAppearance(x, y);
    } else {
      tile.resourceItemId = null;
      tile.regrowAt = null;
      this.resourceSprites.get(`${x},${y}`)?.destroy();
      this.resourceSprites.delete(`${x},${y}`);
    }
    return itemId;
  }

  // Used when clearing the landing area or restoring a permanently depleted mineral.
  removeResource(x, y) {
    const tile = this.tiles[y]?.[x];
    const itemId = tile?.resourceItemId;
    if (!itemId || this.items[itemId]?.mineable !== true) return null;
    tile.resourceItemId = null;
    tile.remainingYield = 0;
    tile.regrowAt = null;
    this.resourceSprites.get(`${x},${y}`)?.destroy();
    this.resourceSprites.delete(`${x},${y}`);
    return itemId;
  }

  updateResourceAppearance(x, y) {
    const tile = this.tiles[y]?.[x];
    const sprite = this.ensureResourceSprite(x, y);
    if (!tile || !sprite) return;
    if (tile.remainingYield <= 0) {
      sprite.setScale?.(0.55);
      sprite.setAlpha?.(0.35);
      return;
    }
    const range = this.resourceSettings?.[tile.resourceItemId]?.yieldRange || [1, 1];
    const ratio = tile.remainingYield / Math.max(1, range[1]);
    const scale = ratio <= 1 / 3 ? 0.7 : ratio <= 2 / 3 ? 0.85 : 1;
    sprite.setScale?.(scale);
    sprite.setAlpha?.(ratio <= 1 / 3 ? 0.7 : ratio <= 2 / 3 ? 0.85 : 1);
  }

  updateRegrowth(now = Date.now()) {
    this.tiles.forEach((row, y) => row.forEach((tile, x) => {
      if (!tile.resourceItemId || tile.remainingYield > 0 || !Number.isFinite(tile.regrowAt)
        || now < tile.regrowAt) return;
      const range = this.resourceSettings[tile.resourceItemId]?.yieldRange || [1, 1];
      tile.totalYield = range[1];
      tile.remainingYield = tile.totalYield;
      tile.regrowAt = null;
      this.updateResourceAppearance(x, y);
      console.log(`Resource regrew: ${tile.resourceItemId} at (${x}, ${y}), yield ${tile.totalYield}`);
    }));
  }

  textureForItem(itemId, context = itemId) {
    return AssetRegistry.resolveTextureKey(this.scene, this.items[itemId]?.spriteKey, context);
  }

  ensureResourceSprite(x, y) {
    const tile = this.tiles[y]?.[x];
    if (!tile?.resourceItemId) return null;
    const key = `${x},${y}`;
    const existing = this.resourceSprites.get(key);
    if (existing) {
      existing.setTexture?.(this.textureForItem(tile.resourceItemId, `resource ${tile.resourceItemId} at ${key}`));
      return existing;
    }
    if (!this.scene?.add?.image) return null;
    const size = this.settings?.tileSize || 32;
    const sprite = this.scene.add.image(
      x * size + size / 2, y * size + size / 2,
      this.textureForItem(tile.resourceItemId, `resource ${tile.resourceItemId} at ${key}`),
    ).setDepth(1);
    if (sprite) this.resourceSprites.set(key, sprite);
    return sprite;
  }

  validatePlacedTextures() {
    this.tiles.forEach((row, y) => row.forEach((tile, x) => {
      if (tile.resourceItemId) this.textureForItem(tile.resourceItemId, `loaded resource ${tile.resourceItemId} at ${x},${y}`);
    }));
    this.baseTiles.forEach(({ itemId }, key) => this.textureForItem(itemId, `loaded structure ${itemId} at ${key}`));
    this.landingPod?.objects.forEach((object) => {
      AssetRegistry.resolveTextureKey(this.scene, object.texture, `loaded pod object ${object.id}`);
    });
  }

  restoreResourceNode(x, y, state) {
    const tile = this.tiles[y]?.[x];
    if (!tile) return;
    if (!state.resourceItemId) { this.removeResource(x, y); return; }
    tile.resourceItemId = state.resourceItemId;
    tile.remainingYield = state.remainingYield;
    tile.totalYield = state.totalYield;
    tile.regrowAt = state.regrowAt ?? null;
    this.updateResourceAppearance(x, y);
  }

  findPodCenter() {
    const centerX = Math.floor(this.settings.widthInTiles / 2);
    const centerY = Math.floor(this.settings.heightInTiles / 2);
    // Leave room for the five-tile footprint and the outside spawn below its door.
    return {
      x: Math.max(2, Math.min(this.settings.widthInTiles - 3, centerX)),
      y: Math.max(2, Math.min(this.settings.heightInTiles - 4, centerY)),
    };
  }

  findWalkableStart() {
    if (this.landingPod) return { ...this.landingPod.spawn };
    return this.findPodCenter();
  }
}
