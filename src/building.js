// Places crafted base parts on clear land and returns removed parts to inventory.
export class Building {
  constructor(map, player, inventory, items) {
    this.map = map;
    this.player = player;
    this.inventory = inventory;
    this.items = items;
    this.active = false;
    this.selectedItemId = null;
    this.listeners = [];
    this.structureListeners = [];
    this.outdoorCheck = () => true;
  }

  placeableItems() {
    return Object.values(this.items).filter((item) => item.placeable === true);
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  onStructureChange(listener) {
    this.structureListeners.push(listener);
  }

  notifyStructureChange(action, x, y, itemId) {
    this.structureListeners.forEach((listener) => listener({ action, x, y, itemId }));
  }

  notifyChange() {
    this.listeners.forEach((listener) => listener(this));
  }

  setActive(active) {
    this.active = active;
    if (!active) this.selectedItemId = null;
    this.notifyChange();
  }

  select(itemId) {
    if (!this.active || !this.items[itemId]?.placeable || this.inventory.count(itemId) < 1) {
      return false;
    }
    this.selectedItemId = itemId;
    this.notifyChange();
    return true;
  }

  setOutdoorCheck(check) { this.outdoorCheck = check; }

  handleTap(worldX, worldY) {
    if (!this.active) return false;
    const size = this.map.settings.tileSize;
    const x = Math.floor(worldX / size);
    const y = Math.floor(worldY / size);
    const placedItemId = this.map.baseAt(x, y);
    if (placedItemId) {
      this.map.removeBase(x, y);
      this.inventory.add(placedItemId);
      console.log(`Build remove: ${placedItemId} at (${x}, ${y})`);
      this.notifyStructureChange('remove', x, y, placedItemId);
      this.notifyChange();
      return 'removed';
    }

    const playerTile = this.player.currentTile();
    if (!this.selectedItemId || this.inventory.count(this.selectedItemId) < 1
      || (playerTile.x === x && playerTile.y === y)) return false;
    if (this.items[this.selectedItemId].outdoorsOnly && !this.outdoorCheck(x, y)) {
      console.log(`Build blocked: ${this.selectedItemId} must be outdoors`);
      return false;
    }
    if (!this.map.placeBase(x, y, this.selectedItemId)) return false;
    this.inventory.consume([{ itemId: this.selectedItemId, quantity: 1 }]);
    console.log(`Build place: ${this.selectedItemId} at (${x}, ${y})`);
    this.notifyStructureChange('place', x, y, this.selectedItemId);
    this.notifyChange();
    return 'placed';
  }
}
