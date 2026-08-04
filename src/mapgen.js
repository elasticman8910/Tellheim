// Builds the same Temperate landscape every time from the configured text seed.
export class TemperateMap {
  constructor(scene, settings, items) {
    this.scene = scene;
    this.settings = settings;
    this.items = items;
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
        row.push({ terrain: type, resourceItemId: resource });
        this.scene.add.image(
          x * tileSize + tileSize / 2,
          y * tileSize + tileSize / 2,
          type,
        );
        if (resource) {
          const resourceSprite = this.scene.add.image(
            x * tileSize + tileSize / 2,
            y * tileSize + tileSize / 2,
            this.items[resource].spriteKey,
          ).setDepth(1);
          this.resourceSprites.set(`${x},${y}`, resourceSprite);
        }
      }
      this.tiles.push(row);
    }

    this.scene.physics.world.setBounds(0, 0, widthInTiles * tileSize, heightInTiles * tileSize);
    this.scene.cameras.main.setBounds(0, 0, widthInTiles * tileSize, heightInTiles * tileSize);
    this.placeLandingPod();
  }

  // The five-tile pod has a solid center and three solid arms, with its south arm as a door.
  placeLandingPod() {
    const center = this.findPodCenter();
    const hullTiles = [
      center,
      { x: center.x - 1, y: center.y },
      { x: center.x + 1, y: center.y },
      { x: center.x, y: center.y - 1 },
    ];
    const door = { x: center.x, y: center.y + 1 };
    const station = { x: center.x + 1, y: center.y + 1 };
    const spawn = { x: center.x, y: center.y + 2 };
    this.landingPod = { center, hullTiles, door, station, spawn };

    // Flatten the complete footprint and door approach so every seed starts safely.
    [...hullTiles, door, station, spawn].forEach(({ x, y }) => {
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
    hullTiles.forEach(({ x, y }) => this.addPodSprite(x, y, 'landingPodHull', size));
    this.addPodSprite(door.x, door.y, 'landingPodDoor', size);
    this.addPodSprite(station.x, station.y, 'suitRechargeStation', size);
  }

  addPodSprite(x, y, texture, size) {
    this.scene?.add?.image(x * size + size / 2, y * size + size / 2, texture)?.setDepth(1);
  }

  isPodHull(x, y) {
    return this.landingPod?.hullTiles.some((tile) => tile.x === x && tile.y === y) || false;
  }

  isPodDoor(x, y) {
    return this.landingPod?.door.x === x && this.landingPod?.door.y === y;
  }

  isRechargeStation(x, y) {
    return this.landingPod?.station.x === x && this.landingPod?.station.y === y;
  }

  isLandingPod(x, y) {
    return this.isPodHull(x, y) || this.isPodDoor(x, y) || this.isRechargeStation(x, y);
  }

  isWalkable(x, y) {
    const baseItemId = this.baseAt(x, y);
    return Boolean(this.tiles[y]?.[x]) && this.tiles[y][x].terrain !== 'terrainWater'
      && !this.isPodHull(x, y) && !this.items[baseItemId]?.blocksMovement;
  }

  baseAt(x, y) {
    return this.baseTiles.get(`${x},${y}`)?.itemId || null;
  }

  // Base parts use a separate layer, leaving seeded terrain unchanged underneath.
  placeBase(x, y, itemId) {
    const key = `${x},${y}`;
    const item = this.items[itemId];
    if (!item?.placeable || !this.tiles[y]?.[x] || this.tiles[y][x].terrain === 'terrainWater'
      || this.resourceAt(x, y) || this.baseTiles.has(key) || this.isLandingPod(x, y)) return false;
    const size = this.settings.tileSize;
    const sprite = this.scene?.add?.image
      ? this.scene.add.image(x * size + size / 2, y * size + size / 2, item.spriteKey).setDepth(1)
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
    const itemId = this.tiles[y]?.[x]?.resourceItemId;
    return itemId && this.items[itemId]?.mineable === true ? itemId : null;
  }

  removeResource(x, y) {
    const tile = this.tiles[y]?.[x];
    const itemId = tile?.resourceItemId;
    if (!itemId || this.items[itemId]?.mineable !== true) return null;
    tile.resourceItemId = null;
    this.resourceSprites.get(`${x},${y}`)?.destroy();
    this.resourceSprites.delete(`${x},${y}`);
    return itemId;
  }

  findPodCenter() {
    const centerX = Math.floor(this.settings.widthInTiles / 2);
    const centerY = Math.floor(this.settings.heightInTiles / 2);
    // Keeping two clear rows below the center leaves room for the door and player spawn.
    return {
      x: Math.max(1, Math.min(this.settings.widthInTiles - 2, centerX)),
      y: Math.max(1, Math.min(this.settings.heightInTiles - 3, centerY)),
    };
  }

  findWalkableStart() {
    if (this.landingPod) return { ...this.landingPod.spawn };
    return this.findPodCenter();
  }
}
