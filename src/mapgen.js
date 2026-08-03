// Builds the same Temperate landscape every time from the configured text seed.
export class TemperateMap {
  constructor(scene, settings, items) {
    this.scene = scene;
    this.settings = settings;
    this.items = items;
    this.tiles = [];
    this.resourceSprites = new Map();
  }

  create() {
    const { widthInTiles, heightInTiles, tileSize, seed } = this.settings;
    const random = new Phaser.Math.RandomDataGenerator([seed]);

    for (let y = 0; y < heightInTiles; y += 1) {
      const row = [];
      for (let x = 0; x < widthInTiles; x += 1) {
        // Averaging nearby random samples produces broad, natural-looking patches.
        const value = (random.frac() + random.frac() + random.frac()) / 3;
        const type = value >= this.settings.waterThreshold
          ? 'terrainWater'
          : value >= this.settings.soilThreshold ? 'terrainSoil' : 'terrainGrass';
        const canHoldResource = type !== 'terrainWater';
        const resourceIds = Object.keys(this.items);
        const resource = canHoldResource && random.frac() < this.settings.resourceSpawnChance
          ? resourceIds[random.integerInRange(0, resourceIds.length - 1)]
          : null;
        row.push({ terrain: type, resource });
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
  }

  isWalkable(x, y) {
    return Boolean(this.tiles[y]?.[x]) && this.tiles[y][x].terrain !== 'terrainWater';
  }

  resourceAt(x, y) {
    return this.tiles[y]?.[x]?.resource || null;
  }

  removeResource(x, y) {
    const tile = this.tiles[y]?.[x];
    if (!tile?.resource) return null;
    const resource = tile.resource;
    tile.resource = null;
    this.resourceSprites.get(`${x},${y}`)?.destroy();
    this.resourceSprites.delete(`${x},${y}`);
    return resource;
  }

  findWalkableStart() {
    const centerX = Math.floor(this.settings.widthInTiles / 2);
    const centerY = Math.floor(this.settings.heightInTiles / 2);
    if (this.isWalkable(centerX, centerY)) return { x: centerX, y: centerY };

    for (let radius = 1; radius < this.settings.widthInTiles; radius += 1) {
      for (let y = centerY - radius; y <= centerY + radius; y += 1) {
        for (let x = centerX - radius; x <= centerX + radius; x += 1) {
          if (this.isWalkable(x, y)) return { x, y };
        }
      }
    }
    return { x: 0, y: 0 };
  }
}
