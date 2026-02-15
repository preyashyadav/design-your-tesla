import { Box3, Material, Mesh, Object3D, Vector3 } from 'three';
import type { ManagedMaterialKey } from '../config/designer';
import type { MaterialEntry } from '../types/material';

const BODY_PAINT_CANDIDATES = new Set(['body_paint', 'body paint', 'bodypaint']);

type ColorLike = {
  getHexString: () => string;
  isColor: boolean;
  set: (value: string) => void;
};

export type ColorCapableMaterial = Material & { color: ColorLike };
type FinishCapableMaterial = Material & {
  attenuationDistance?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  envMapIntensity?: number;
  flatShading?: boolean;
  metalness?: number;
  opacity?: number;
  roughness?: number;
  thickness?: number;
  transparent?: boolean;
  transmission?: number;
};

function disableUnsupportedMaterialFeatures(material: Material): void {
  const finish = material as FinishCapableMaterial;

  // Expo GL does not support the multisample path used by Three transmission rendering.
  finish.transmission = 0;
  finish.thickness = 0;
  finish.attenuationDistance = undefined;
}

export function materialHasColor(material: Material): material is ColorCapableMaterial {
  const maybeColor = (material as { color?: unknown }).color;
  return (
    typeof maybeColor === 'object' &&
    maybeColor !== null &&
    (maybeColor as { isColor?: boolean }).isColor === true
  );
}

export function extractMaterialsFromScene(scene: Object3D): MaterialEntry[] {
  const byId = new Map<string, MaterialEntry>();

  scene.traverse((node: Object3D) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material: Material, index: number) => {
      if (!material || byId.has(material.uuid)) {
        return;
      }

      disableUnsupportedMaterialFeatures(material);

      const fallbackName = `${node.name || 'Material'}_${index + 1}`;
      byId.set(material.uuid, {
        id: material.uuid,
        name: material.name?.trim() || fallbackName,
        material,
      });
    });
  });

  return [...byId.values()];
}

export function getDefaultMaterialId(materials: MaterialEntry[]): string | null {
  if (materials.length === 0) {
    return null;
  }

  const preferred = materials.find((entry) =>
    BODY_PAINT_CANDIDATES.has(entry.name.trim().toLowerCase()),
  );

  return preferred?.id ?? materials[0].id;
}

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

  if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
    const [r, g, b] = withHash.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return withHash.toUpperCase();
  }

  if (/^#[0-9A-Fa-f]{8}$/.test(withHash)) {
    return withHash.slice(0, 7).toUpperCase();
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*(?:\d+(?:\.\d+)?))?\s*\)$/i,
  );
  if (rgbMatch) {
    const toHex = (valuePart: string) => {
      const n = Math.max(0, Math.min(255, Number.parseInt(valuePart, 10)));
      return n.toString(16).padStart(2, '0');
    };

    const [, r, g, b] = rgbMatch;
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  return null;
}

export function centerAndScaleScene(scene: Object3D, targetSize = 2.8): void {
  const initialBox = new Box3().setFromObject(scene);
  if (initialBox.isEmpty()) {
    return;
  }

  const size = initialBox.getSize(new Vector3());
  const largestAxis = Math.max(size.x, size.y, size.z);
  if (largestAxis > 0) {
    scene.scale.setScalar(targetSize / largestAxis);
  }

  const centeredBox = new Box3().setFromObject(scene);
  const center = centeredBox.getCenter(new Vector3());
  scene.position.sub(center);
}

export function applyMaterialFinish(material: Material, key: ManagedMaterialKey): void {
  const finish = material as FinishCapableMaterial;
  disableUnsupportedMaterialFeatures(material);

  finish.flatShading = false;

  if (key === 'material_3') {
    finish.roughness = 0.06;
    finish.metalness = 0.15;
    finish.transparent = true;
    finish.opacity = 0.42;
    finish.envMapIntensity = 1.15;
    finish.clearcoat = 0.8;
    finish.clearcoatRoughness = 0.03;
    material.needsUpdate = true;
    return;
  }

  if (key === 'material_8') {
    finish.roughness = 0.9;
    finish.metalness = 0.05;
    finish.envMapIntensity = 0.35;
    material.needsUpdate = true;
    return;
  }

  if (key === 'material_9') {
    finish.roughness = 0.24;
    finish.metalness = 0.9;
    finish.envMapIntensity = 1.2;
    finish.clearcoat = 0.9;
    finish.clearcoatRoughness = 0.12;
    material.needsUpdate = true;
    return;
  }

  if (key === 'material_7') {
    finish.roughness = 0.3;
    finish.metalness = 0.85;
    finish.envMapIntensity = 1.05;
    material.needsUpdate = true;
    return;
  }

  if (key === 'material_5') {
    finish.roughness = 0.35;
    finish.metalness = 0.75;
    finish.envMapIntensity = 0.9;
    material.needsUpdate = true;
    return;
  }

  if (key === 'material_6') {
    finish.roughness = 0.42;
    finish.metalness = 0.55;
    finish.envMapIntensity = 0.8;
    material.needsUpdate = true;
    return;
  }

  finish.roughness = 0.55;
  finish.metalness = 0.45;
  finish.envMapIntensity = 0.7;
  material.needsUpdate = true;
}
