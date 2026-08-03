// Converts an adjacent resource tile into one inventory item after a short mining delay.
export class Mining {
  constructor(map, player, inventory, settings) {
    this.map = map;
    this.player = player;
    this.inventory = inventory;
    this.settings = settings;
    this.pending = new Set();
  }

  tryMine(tile) {
    const itemId = this.map.resourceAt(tile.x, tile.y);
    if (!itemId) return false;

    const playerTile = this.player.currentTile();
    const distance = Math.abs(playerTile.x - tile.x) + Math.abs(playerTile.y - tile.y);
    const tileKey = `${tile.x},${tile.y}`;
    if (distance > this.settings.maximumTileDistance || this.pending.has(tileKey)) return false;

    this.pending.add(tileKey);
    console.log(`Mining started: ${itemId} at (${tile.x}, ${tile.y})`);
    window.setTimeout(() => {
      this.pending.delete(tileKey);
      const minedItem = this.map.removeResource(tile.x, tile.y);
      if (!minedItem) return;
      this.inventory.add(minedItem);
      console.log(`Mining completed: ${minedItem} at (${tile.x}, ${tile.y})`);
    }, this.settings.delayMilliseconds);
    return true;
  }
}
