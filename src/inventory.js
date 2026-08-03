// Stores item counts and tells listeners whenever a mined item is added.
export class Inventory {
  constructor(items, savedCounts = {}) {
    this.items = items;
    this.counts = this.reconcile(savedCounts);
    this.listeners = [];
  }

  // Loaded counts are normalized here so old saves cannot retain excess unique items.
  reconcile(savedCounts) {
    return Object.fromEntries(Object.entries(savedCounts).flatMap(([itemId, count]) => {
      const item = this.items[itemId];
      if (!item || !Number.isFinite(count) || count <= 0) return [];
      return [[itemId, Math.min(Math.floor(count), item.maxCount ?? Infinity)]];
    }));
  }

  add(itemId, amount = 1) {
    const item = this.items[itemId];
    if (!item) return false;
    this.counts[itemId] = Math.min((this.counts[itemId] || 0) + amount, item.maxCount ?? Infinity);
    console.log(`Inventory changed: ${itemId} = ${this.counts[itemId]}`);
    this.listeners.forEach((listener) => listener(this.counts));
    return true;
  }

  consume(ingredients) {
    if (!ingredients.every(({ itemId, quantity }) => this.count(itemId) >= quantity)) return false;
    ingredients.forEach(({ itemId, quantity }) => {
      this.counts[itemId] -= quantity;
    });
    console.log('Inventory ingredients consumed');
    this.listeners.forEach((listener) => listener(this.counts));
    return true;
  }

  count(itemId) {
    return this.counts[itemId] || 0;
  }

  onChange(listener) {
    this.listeners.push(listener);
  }
}
