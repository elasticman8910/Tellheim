// Checks recipes, spends their ingredients, and places crafted results in the inventory.
export class Crafting {
  constructor(inventory, items) {
    this.inventory = inventory;
    this.items = items;
  }

  recipes() {
    return Object.values(this.items).filter((item) => (
      item.recipe && (item.maxCount === undefined || this.inventory.count(item.id) < item.maxCount)
    ));
  }

  canCraft(recipe) {
    const outputItem = this.items[recipe.output.itemId];
    if (outputItem?.maxCount !== undefined
      && this.inventory.count(outputItem.id) + recipe.output.quantity > outputItem.maxCount) {
      return false;
    }
    return recipe.ingredients.every(
      ({ itemId, quantity }) => this.inventory.count(itemId) >= quantity,
    );
  }

  craft(itemId) {
    const item = this.items[itemId];
    console.log(`Craft attempt: ${itemId}`);
    if (!item || !item.recipe) {
      console.log(`Craft failed: no recipe for ${itemId}`);
      return false;
    }
    if (!this.canCraft(item.recipe)) {
      console.log(`Craft failed: insufficient ingredients for ${itemId}`);
      return false;
    }

    this.inventory.consume(item.recipe.ingredients);
    const output = item.recipe.output;
    this.inventory.add(output.itemId, output.quantity);
    console.log(`Craft succeeded: ${output.itemId} × ${output.quantity}`);
    return true;
  }
}
