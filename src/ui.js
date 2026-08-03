// Provides HUD buttons and full-screen, touch-friendly inventory and crafting overlays.
export class GameUI {
  constructor(scene, inventory, crafting, items, settings, mining) {
    this.scene = scene;
    this.inventory = inventory;
    this.crafting = crafting;
    this.items = items;
    this.settings = settings;
    this.open = false;
    this.overlayObjects = [];
    this.mining = mining;

    this.inventoryButton = scene.add.text(0, 0, 'Inventory', {
      backgroundColor: '#25333d', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '18px',
      align: 'center',
    }).setFixedSize(120, settings.touchTargetSize).setDepth(20).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.inventoryButton.on('pointerup', (_, __, ___, event) => {
      event.stopPropagation();
      this.showInventory();
    });
    this.craftButton = scene.add.text(0, 0, 'Craft', {
      backgroundColor: '#3e6680', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '18px',
      align: 'center',
    }).setFixedSize(120, settings.touchTargetSize).setDepth(20).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.craftButton.on('pointerup', (_, __, ___, event) => {
      event.stopPropagation();
      this.showCrafting();
    });
    this.resumeButton = this.makeQueueButton('Resume', '#3e6680', () => this.mining.resumeQueue());
    this.clearQueueButton = this.makeQueueButton('\u2715', '#713d3d', () => this.mining.clearQueue());
    mining.onQueueChange((queue, paused) => this.updateQueueButtons(queue, paused));
    scene.scale.on('resize', () => this.layout());
    inventory.onChange(() => {
      if (this.open === 'inventory') this.showInventory();
      if (this.open === 'crafting') this.showCrafting();
    });
    this.layout();
    this.updateQueueButtons(mining.queue, mining.paused);
  }

  makeQueueButton(label, color, action) {
    const button = this.scene.add.text(0, 0, label, {
      backgroundColor: color, color: '#ffffff', fontFamily: 'sans-serif', fontSize: '18px',
      align: 'center',
    }).setFixedSize(label === '\u2715' ? this.settings.touchTargetSize : 100, this.settings.touchTargetSize)
      .setDepth(20).setScrollFactor(0).setInteractive({ useHandCursor: true });
    button.on('pointerup', (_, __, ___, event) => {
      event.stopPropagation();
      action();
    });
    return button;
  }

  updateQueueButtons(queue, paused) {
    this.resumeButton.setVisible(queue.length > 0 && paused);
    this.clearQueueButton.setVisible(queue.length > 0);
  }

  layout() {
    this.inventoryButton.setPosition(this.settings.screenPadding, this.settings.screenPadding);
    this.craftButton.setPosition(
      this.scene.scale.width - this.settings.screenPadding - 120,
      this.settings.screenPadding,
    );
    const bottom = this.scene.scale.height - this.settings.screenPadding - this.settings.touchTargetSize;
    this.resumeButton.setPosition(this.settings.screenPadding, bottom);
    this.clearQueueButton.setPosition(
      this.scene.scale.width - this.settings.screenPadding - this.settings.touchTargetSize,
      bottom,
    );
    if (this.open === 'inventory') this.showInventory();
    if (this.open === 'crafting') this.showCrafting();
  }

  showInventory() {
    this.closeInventory();
    this.open = 'inventory';
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const padding = this.settings.screenPadding;
    const add = (object) => { this.overlayObjects.push(object); return object; };
    add(this.scene.add.rectangle(0, 0, width, height, 0x162027, 0.98)
      .setOrigin(0).setDepth(30).setScrollFactor(0).setInteractive());
    add(this.scene.add.text(padding, padding, 'Inventory', {
      color: '#ffffff', fontFamily: 'sans-serif', fontSize: '28px', fontStyle: 'bold',
    }).setDepth(31).setScrollFactor(0));

    Object.values(this.items).forEach((item, index) => {
      const y = padding + 64 + index * this.settings.inventoryRowHeight;
      add(this.scene.add.image(padding + 20, y + 20, item.spriteKey)
        .setDisplaySize(40, 40).setDepth(31).setScrollFactor(0));
      add(this.scene.add.text(padding + 52, y + 8, `${item.name}  × ${this.inventory.count(item.id)}`, {
        color: '#ffffff', fontFamily: 'sans-serif', fontSize: '20px',
      }).setDepth(31).setScrollFactor(0));
    });

    const close = add(this.scene.add.text(width / 2, height - padding, 'Close', {
      backgroundColor: '#3e6680', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '20px',
      align: 'center',
    }).setFixedSize(150, this.settings.touchTargetSize).setOrigin(0.5, 1).setDepth(31)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    close.on('pointerup', (_, __, ___, event) => {
      event.stopPropagation();
      this.closeInventory();
    });
  }

  showCrafting() {
    this.closeOverlay();
    this.open = 'crafting';
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const padding = this.settings.screenPadding;
    const add = (object) => { this.overlayObjects.push(object); return object; };
    add(this.scene.add.rectangle(0, 0, width, height, 0x162027, 0.98)
      .setOrigin(0).setDepth(30).setScrollFactor(0).setInteractive());
    add(this.scene.add.text(padding, padding, 'Crafting', {
      color: '#ffffff', fontFamily: 'sans-serif', fontSize: '28px', fontStyle: 'bold',
    }).setDepth(31).setScrollFactor(0));

    this.crafting.recipes().forEach((item, index) => {
      const affordable = this.crafting.canCraft(item.recipe);
      const y = padding + 60 + index * 104;
      const ingredientText = item.recipe.ingredients.map(({ itemId, quantity }) => {
        const ingredient = this.items[itemId];
        return `${ingredient.name}: ${this.inventory.count(itemId)}/${quantity}`;
      }).join('  •  ');
      const recipeButton = add(this.scene.add.text(padding, y, item.name, {
        backgroundColor: affordable ? '#3e6680' : '#3a4145',
        color: affordable ? '#ffffff' : '#899297',
        fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', padding: { x: 12, y: 8 },
      }).setFixedSize(width - padding * 2, this.settings.touchTargetSize).setDepth(31)
        .setScrollFactor(0).setInteractive({ useHandCursor: affordable }));
      add(this.scene.add.text(padding + 4, y + this.settings.touchTargetSize + 5, ingredientText, {
        color: affordable ? '#d9e6ec' : '#7d8589', fontFamily: 'sans-serif', fontSize: '15px',
        wordWrap: { width: width - padding * 2 - 8 },
      }).setDepth(31).setScrollFactor(0));
      recipeButton.on('pointerup', (_, __, ___, event) => {
        event.stopPropagation();
        this.crafting.craft(item.id);
      });
    });

    this.addCloseButton(add, width, height, padding);
  }

  addCloseButton(add, width, height, padding) {
    const close = add(this.scene.add.text(width / 2, height - padding, 'Close', {
      backgroundColor: '#3e6680', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '20px',
      align: 'center',
    }).setFixedSize(150, this.settings.touchTargetSize).setOrigin(0.5, 1).setDepth(32)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    close.on('pointerup', (_, __, ___, event) => {
      event.stopPropagation();
      this.closeOverlay();
    });
  }

  closeInventory() {
    this.closeOverlay();
  }

  closeOverlay() {
    this.overlayObjects.forEach((object) => object.destroy());
    this.overlayObjects = [];
    this.open = false;
  }
}
