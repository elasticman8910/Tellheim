// Turns manifest entries into Phaser textures, whether they use placeholders or real art.
export const FALLBACK_TEXTURE_KEY = 'debugMissingTextureMagenta';

export class AssetRegistry {
  static queueImages(scene, manifest) {
    Object.entries(manifest).forEach(([key, asset]) => {
      if (asset.type === 'image') scene.load.image(key, asset.path);
    });
  }

  static createPlaceholders(scene, manifest) {
    Object.entries(manifest).forEach(([key, asset]) => {
      if (asset.type !== 'generated') return;
      AssetRegistry.createSolidTexture(scene, key, asset);
    });
    AssetRegistry.registerFallback(scene);
  }

  static registerFallback(scene) {
    if (AssetRegistry.hasTexture(scene, FALLBACK_TEXTURE_KEY)) return;
    AssetRegistry.createSolidTexture(scene, FALLBACK_TEXTURE_KEY, {
      color: '#ff00ff', borderColor: '#ffffff', borderWidth: 4, width: 32, height: 32,
    });
  }

  static createSolidTexture(scene, key, asset) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    const color = Phaser.Display.Color.HexStringToColor(asset.color).color;
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, asset.width, asset.height);
    if (asset.borderColor && asset.borderWidth) {
      const borderColor = Phaser.Display.Color.HexStringToColor(asset.borderColor).color;
      graphics.lineStyle(asset.borderWidth, borderColor, 1);
      const inset = asset.borderWidth / 2;
      graphics.strokeRect(inset, inset, asset.width - asset.borderWidth, asset.height - asset.borderWidth);
    }
    graphics.generateTexture(key, asset.width, asset.height);
    graphics.destroy();
  }

  static hasTexture(scene, key) {
    if (!key) return false;
    const textures = scene?.textures;
    if (typeof textures?.exists === 'function') return textures.exists(key);
    if (typeof textures?.get === 'function') return Boolean(textures.get(key));
    return false;
  }

  static resolveTextureKey(scene, key, context = 'sprite') {
    if (AssetRegistry.hasTexture(scene, key)) return key;
    console.error(`Missing texture: ${key || '(empty)'} for ${context}; using ${FALLBACK_TEXTURE_KEY}`);
    return FALLBACK_TEXTURE_KEY;
  }

  static installFailsafe(scene) {
    AssetRegistry.registerFallback(scene);
    AssetRegistry.wrapImageFactory(scene, scene?.add, 'image');
    AssetRegistry.wrapImageFactory(scene, scene?.physics?.add, 'physics image');
  }

  static wrapImageFactory(scene, factory, label) {
    if (!factory?.image || factory.image.__tellheimFailsafe) return;
    const originalImage = factory.image.bind(factory);
    const safeImage = (x, y, key, ...rest) => originalImage(
      x, y, AssetRegistry.resolveTextureKey(scene, key, `${label} at ${Math.round(x)},${Math.round(y)}`), ...rest,
    );
    safeImage.__tellheimFailsafe = true;
    factory.image = safeImage;
  }
}
