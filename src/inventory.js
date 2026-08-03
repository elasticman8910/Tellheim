// Stores item counts and tells listeners whenever a mined item is added.
export class Inventory {
  constructor() {
    this.counts = {};
    this.listeners = [];
  }

  add(itemId, amount = 1) {
    this.counts[itemId] = (this.counts[itemId] || 0) + amount;
    console.log(`Inventory changed: ${itemId} = ${this.counts[itemId]}`);
    this.listeners.forEach((listener) => listener(this.counts));
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
