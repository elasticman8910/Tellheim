// Converts an adjacent resource tile into one inventory item after a short mining delay.
export class Mining {
  constructor(map, player, inventory, settings) {
    this.map = map;
    this.player = player;
    this.inventory = inventory;
    this.settings = settings;
    this.pending = new Set();
    this.approachTarget = null;
  }

  mineOrApproach(tile) {
    const itemId = this.map.resourceAt(tile.x, tile.y);
    if (!itemId) return false;
    this.approachTarget = null;

    const playerTile = this.player.currentTile();
    const distance = Math.abs(playerTile.x - tile.x) + Math.abs(playerTile.y - tile.y);
    const tileKey = `${tile.x},${tile.y}`;
    if (this.pending.has(tileKey)) return true;
    if (distance <= this.settings.maximumTileDistance) {
      this.startMining(tile, itemId);
      return true;
    }

    const destinations = [
      tile,
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ];
    const destination = this.player.moveToNearest(destinations);
    if (!destination) {
      console.log(`No walkable route to resource at (${tile.x}, ${tile.y})`);
      return true;
    }

    this.approachTarget = { ...tile };
    console.log(`Moving to mine ${itemId} at (${tile.x}, ${tile.y})`);
    return true;
  }

  cancelApproach() {
    this.approachTarget = null;
  }

  update() {
    if (!this.approachTarget) return;
    const itemId = this.map.resourceAt(this.approachTarget.x, this.approachTarget.y);
    if (!itemId) {
      this.approachTarget = null;
      return;
    }

    const playerTile = this.player.currentTile();
    const distance = Math.abs(playerTile.x - this.approachTarget.x)
      + Math.abs(playerTile.y - this.approachTarget.y);
    if (distance > this.settings.maximumTileDistance) return;

    const tile = this.approachTarget;
    this.approachTarget = null;
    this.startMining(tile, itemId);
  }

  startMining(tile, itemId) {
    const tileKey = `${tile.x},${tile.y}`;
    this.pending.add(tileKey);
    const ownsPickaxe = this.inventory.count('pickaxe') > 0;
    const delay = this.settings.delayMilliseconds
      * (ownsPickaxe ? this.settings.pickaxeDelayMultiplier : 1);
    console.log(`Mining started: ${itemId} at (${tile.x}, ${tile.y}), delay ${delay}ms`);
    window.setTimeout(() => {
      this.pending.delete(tileKey);
      const minedItem = this.map.removeResource(tile.x, tile.y);
      if (!minedItem) return;
      this.inventory.add(minedItem);
      console.log(`Mining completed: ${minedItem} at (${tile.x}, ${tile.y})`);
    }, delay);
  }
}
