// Provides HUD buttons and full-screen, touch-friendly inventory and crafting overlays.
export class GameUI {
  constructor(scene, inventory, crafting, items, settings, mining, building, oxygen, dayNight, power, temperature) {
    this.scene = scene;
    this.inventory = inventory;
    this.crafting = crafting;
    this.items = items;
    this.settings = settings;
    this.open = false;
    this.overlayObjects = [];
    this.mining = mining;
    this.building = building;
    this.paletteObjects = [];
    this.oxygen = oxygen;
    this.dayNight = dayNight;
    this.power = power;
    this.temperature = temperature;

    this.oxygenLabel = scene.add.text(0, 0, 'O₂', {
      color: '#ffffff', fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
    }).setDepth(20).setScrollFactor(0);
    this.oxygenBack = scene.add.rectangle(0, 0, 150, 12, 0x25333d).setOrigin(0).setDepth(20).setScrollFactor(0);
    this.oxygenBar = scene.add.rectangle(0, 0, 150, 12, 0x55cce0).setOrigin(0).setDepth(21).setScrollFactor(0);
    this.healthLabel = scene.add.text(0, 0, 'HP', {
      color: '#ffffff', fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
    }).setDepth(20).setScrollFactor(0);
    this.healthBack = scene.add.rectangle(0, 0, 150, 10, 0x25333d).setOrigin(0).setDepth(20).setScrollFactor(0);
    this.healthBar = scene.add.rectangle(0, 0, 150, 10, 0xd45454).setOrigin(0).setDepth(21).setScrollFactor(0);
    this.suitLabel = scene.add.text(0, 0, 'SUIT', {
      color: '#ffffff', fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
    }).setDepth(20).setScrollFactor(0);
    this.suitBack = scene.add.rectangle(0, 0, 150, 10, 0x25333d).setOrigin(0).setDepth(20).setScrollFactor(0);
    this.suitBar = scene.add.rectangle(0, 0, 150, 10, 0xe0b955).setOrigin(0).setDepth(21).setScrollFactor(0);
    oxygen.onChange(() => this.updateSurvivalBars());
    this.cycleLabel = scene.add.text(0, 0, '', {
      color: '#fff1ad', fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
      backgroundColor: '#25333dcc', padding: { x: 6, y: 4 },
    }).setDepth(20).setScrollFactor(0);
    this.powerLabel = scene.add.text(0, 0, '', {
      color: '#d9f0ff', fontFamily: 'sans-serif', fontSize: '13px',
      backgroundColor: '#25333dcc', padding: { x: 6, y: 4 },
    }).setDepth(20).setScrollFactor(0);
    dayNight.onChange(() => this.updatePowerReadout());
    power.onChange(() => this.updatePowerReadout());
    this.temperatureLabel = scene.add.text(0, 0, '', {
      color: '#bde9ff', fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
      backgroundColor: '#25333dcc', padding: { x: 6, y: 4 },
    }).setDepth(20).setScrollFactor(0);
    temperature.onChange(() => this.updateTemperatureReadout());

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
    this.buildButton = scene.add.text(0, 0, 'Build', {
      backgroundColor: '#53616b', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '18px',
      align: 'center',
    }).setFixedSize(100, settings.touchTargetSize).setDepth(20).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.buildButton.on('pointerup', (_, __, ___, event) => {
      event.stopPropagation();
      this.building.setActive(!this.building.active);
    });
    this.resumeButton = this.makeQueueButton('Resume', '#3e6680', () => {
      this.mining.resumeQueue('resume-button');
    });
    this.clearQueueButton = this.makeQueueButton('\u2715', '#a32929', () => this.mining.cancelQueue());
    mining.onQueueChange((queue, paused) => this.updateQueueButtons(queue, paused));
    scene.scale.on('resize', () => this.layout());
    inventory.onChange(() => {
      if (this.open === 'inventory') this.showInventory();
      if (this.open === 'crafting') this.showCrafting();
      if (this.building.active) this.showBuildPalette();
    });
    building.onChange(() => this.showBuildPalette());
    this.layout();
    this.updateQueueButtons(mining.queue, mining.paused);
    this.updateSurvivalBars();
    this.updatePowerReadout();
    this.updateTemperatureReadout();
  }

  updatePowerReadout() {
    const icon = ['day', 'dawn'].includes(this.dayNight.phase) ? '\u2600' : '\u263e';
    const name = this.dayNight.phase[0].toUpperCase() + this.dayNight.phase.slice(1);
    this.cycleLabel.setText(`${icon} ${name} ${Math.ceil(this.dayNight.timeRemaining())}s`);
    this.powerLabel.setText(`PWR +${this.power.generationPerSecond().toFixed(1)}  -${this.power.drawPerSecond().toFixed(1)}  BAT ${this.power.batteryPercent().toFixed(0)}%`);
  }

  updateSurvivalBars() {
    this.oxygenBar.scaleX = this.oxygen.oxygen / this.oxygen.settings.capacitySeconds;
    this.healthBar.scaleX = this.oxygen.health / this.oxygen.player.settings.healthCapacity;
  }

  updateTemperatureReadout() {
    this.suitBar.scaleX = this.temperature.suitPower / this.temperature.settings.suitPowerCapacity;
    const danger = this.temperature.ambientTemperature < this.temperature.settings.safeMinimumCelsius
      && !this.temperature.isPlayerWarm();
    this.temperatureLabel.setText(`${danger ? '\u2744' : '\u25cf'} ${this.temperature.ambientTemperature.toFixed(1)}\u00b0C`);
    this.temperatureLabel.setColor(danger ? '#ff7777' : '#bde9ff');
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
    const showResume = queue.length > 0 && paused;
    if (showResume && !this.resumeButton.visible) console.log('Queue resume-shown');
    this.resumeButton.setVisible(showResume);
    this.clearQueueButton.setVisible(queue.length > 0);
  }

  layout() {
    this.inventoryButton.setPosition(this.settings.screenPadding, this.settings.screenPadding);
    this.craftButton.setPosition(
      this.scene.scale.width - this.settings.screenPadding - 120,
      this.settings.screenPadding,
    );
    this.buildButton?.setPosition((this.scene.scale.width - 100) / 2, this.settings.screenPadding);
    const meterX = this.settings.screenPadding + 25;
    const meterY = this.settings.screenPadding + this.settings.touchTargetSize + 10;
    this.oxygenLabel?.setPosition(this.settings.screenPadding, meterY - 4);
    this.oxygenBack?.setPosition(meterX, meterY);
    this.oxygenBar?.setPosition(meterX, meterY);
    this.healthLabel?.setPosition(this.settings.screenPadding, meterY + 17);
    this.healthBack?.setPosition(meterX, meterY + 20);
    this.healthBar?.setPosition(meterX, meterY + 20);
    this.suitLabel?.setPosition(this.settings.screenPadding, meterY + 37);
    this.suitBack?.setPosition(meterX, meterY + 40);
    this.suitBar?.setPosition(meterX, meterY + 40);
    this.temperatureLabel?.setPosition(this.settings.screenPadding, meterY + 58);
    this.cycleLabel?.setPosition(this.settings.screenPadding, meterY + 88);
    this.powerLabel?.setPosition(this.settings.screenPadding, meterY + 118);
    const width = this.scene.scale.gameSize?.width || this.scene.scale.width;
    const height = this.scene.scale.gameSize?.height || this.scene.scale.height;
    const buttonSize = this.settings.touchTargetSize;
    const right = width - this.settings.screenPadding;
    // Stack queue controls in right-thumb reach, with a full button-height safety gap.
    const resumeY = height - this.settings.screenPadding - buttonSize * 2;
    this.resumeButton.setPosition(right - 100, resumeY);
    this.clearQueueButton.setPosition(right - buttonSize, resumeY - buttonSize * 2);
    if (this.open === 'inventory') this.showInventory();
    if (this.open === 'crafting') this.showCrafting();
    if (this.building?.active) this.showBuildPalette();
  }

  showBuildPalette() {
    this.paletteObjects.forEach((object) => object.destroy());
    this.paletteObjects = [];
    const active = this.building.active;
    this.buildButton.setText(active ? 'Done' : 'Build');
    this.buildButton.setBackgroundColor(active ? '#3e6680' : '#53616b');
    if (!active) return;

    const owned = this.building.placeableItems()
      .filter((item) => this.inventory.count(item.id) > 0);
    const padding = this.settings.screenPadding;
    const gap = 8;
    const buttonHeight = this.settings.touchTargetSize;
    const width = this.scene.scale.width - padding * 2;
    const buttonWidth = owned.length ? (width - gap * (owned.length - 1)) / owned.length : width;
    const y = this.scene.scale.height - padding - buttonHeight;
    const add = (object) => { this.paletteObjects.push(object); return object; };

    if (!owned.length) {
      add(this.scene.add.text(padding, y, 'Craft a base part to place it', {
        backgroundColor: '#25333d', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '16px',
        align: 'center',
      }).setFixedSize(width, buttonHeight).setDepth(21).setScrollFactor(0));
      return;
    }

    owned.forEach((item, index) => {
      const selected = this.building.selectedItemId === item.id;
      const button = add(this.scene.add.text(padding + index * (buttonWidth + gap), y,
        `${item.name} ×${this.inventory.count(item.id)}`, {
          backgroundColor: selected ? '#3e6680' : '#25333d', color: '#ffffff',
          fontFamily: 'sans-serif', fontSize: '15px', align: 'center',
        }).setFixedSize(buttonWidth, buttonHeight).setDepth(21).setScrollFactor(0)
        .setInteractive({ useHandCursor: true }));
      button.on('pointerup', (_, __, ___, event) => {
        event.stopPropagation();
        this.building.select(item.id);
      });
    });
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
      const y = padding + 60 + index * 92;
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
