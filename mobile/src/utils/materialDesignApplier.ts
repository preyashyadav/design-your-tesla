import {
  DataTexture,
  LinearFilter,
  Material,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import type { FinishType, MaterialDesignConfig, PatternId } from '../types/design';
import { materialHasColor, normalizeHex } from './materials';

type StylableMaterial = Material & {
  attenuationDistance?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  envMapIntensity?: number;
  map?: DataTexture | null;
  metalness?: number;
  opacity?: number;
  roughness?: number;
  thickness?: number;
  transparent?: boolean;
  transmission?: number;
};

const PATTERN_TEXTURE_CACHE = new Map<PatternId, DataTexture | null>();

function createPatternTexture(patternId: Exclude<PatternId, 'NONE'>): DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let shade = 255;
      if (patternId === 'PATTERN_1') {
        shade = (x + y) % 14 < 7 ? 255 : 126;
      } else if (patternId === 'PATTERN_2') {
        const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
        shade = checker ? 255 : 112;
      } else {
        const cx = (x % 12) - 6;
        const cy = (y % 12) - 6;
        const isDot = cx * cx + cy * cy < 10;
        shade = isDot ? 110 : 255;
      }

      const idx = (y * size + x) * 4;
      data[idx] = shade;
      data[idx + 1] = shade;
      data[idx + 2] = shade;
      data[idx + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function getPatternTexture(patternId: PatternId): DataTexture | null {
  if (PATTERN_TEXTURE_CACHE.has(patternId)) {
    return PATTERN_TEXTURE_CACHE.get(patternId) ?? null;
  }

  if (patternId === 'NONE') {
    PATTERN_TEXTURE_CACHE.set(patternId, null);
    return null;
  }

  const texture = createPatternTexture(patternId);
  PATTERN_TEXTURE_CACHE.set(patternId, texture);
  return texture;
}

function disableUnsupportedTransmission(material: StylableMaterial): void {
  material.transmission = 0;
  material.thickness = 0;
  material.attenuationDistance = undefined;
}

function applyFinish(
  material: StylableMaterial,
  key: string,
  finish: FinishType,
): void {
  const isGloss = finish === 'GLOSS';
  const normalizedKey = key.toLowerCase();
  const isTire = normalizedKey === 'material_8' || normalizedKey.includes('tire');
  const isGlass = normalizedKey === 'material_3' || normalizedKey.includes('glass');

  if (isGlass) {
    material.transparent = true;
    material.opacity = isGloss ? 0.38 : 0.45;
    material.roughness = isGloss ? 0.08 : 0.22;
    material.metalness = 0.12;
    material.clearcoat = 0.75;
    material.clearcoatRoughness = 0.05;
    material.envMapIntensity = 1.1;
    return;
  }

  material.transparent = false;
  material.opacity = 1;
  material.clearcoat = isGloss ? 0.9 : 0.2;
  material.clearcoatRoughness = isGloss ? 0.12 : 0.5;
  material.envMapIntensity = isGloss ? 1.05 : 0.75;
  material.roughness = isTire ? (isGloss ? 0.85 : 0.97) : isGloss ? 0.24 : 0.65;
  material.metalness = isTire ? (isGloss ? 0.14 : 0.05) : isGloss ? 0.82 : 0.36;
}

export function applyMaterialDesign(
  material: Material,
  key: string,
  config: MaterialDesignConfig,
): void {
  const stylable = material as StylableMaterial;
  disableUnsupportedTransmission(stylable);

  const safeHex = normalizeHex(config.colorHex) ?? '#111317';
  if (materialHasColor(material)) {
    material.color.set(safeHex);
  }

  applyFinish(stylable, key, config.finish);

  const patternTexture = getPatternTexture(config.patternId);
  stylable.map = patternTexture;
  if (stylable.map) {
    stylable.map.repeat.set(key === 'material_9' ? 3 : 4, key === 'material_9' ? 3 : 4);
    stylable.map.needsUpdate = true;
  }

  material.needsUpdate = true;
}
