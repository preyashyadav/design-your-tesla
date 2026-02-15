import { MANAGED_MATERIAL_ORDER, type ManagedMaterialKey } from './designer';
import type { DesignState, MaterialDesignConfig } from '../types/design';

export const COLOR_SUGGESTIONS: string[] = [
  '#0C0D10',
  '#191C22',
  '#2E343E',
  '#596474',
  '#8D1723',
  '#C0202F',
  '#AAB3C1',
  '#E1E6EE',
];

const DEFAULT_BY_PART: Record<ManagedMaterialKey, MaterialDesignConfig> = {
  material_1: {
    colorHex: '#8D1723',
    finish: 'MATTE',
    patternId: 'NONE',
  },
  material_3: {
    colorHex: '#1A2330',
    finish: 'GLOSS',
    patternId: 'NONE',
  },
  material_5: {
    colorHex: '#1C212A',
    finish: 'MATTE',
    patternId: 'NONE',
  },
  material_6: {
    colorHex: '#242D38',
    finish: 'MATTE',
    patternId: 'NONE',
  },
  material_7: {
    colorHex: '#3B4656',
    finish: 'GLOSS',
    patternId: 'NONE',
  },
  material_8: {
    colorHex: '#141619',
    finish: 'MATTE',
    patternId: 'NONE',
  },
  material_9: {
    colorHex: '#111317',
    finish: 'GLOSS',
    patternId: 'NONE',
  },
};

export function createDefaultDesignState(): DesignState {
  return MANAGED_MATERIAL_ORDER.reduce<DesignState>((acc, key) => {
    const source = DEFAULT_BY_PART[key];
    acc[key] = {
      colorHex: source.colorHex,
      finish: source.finish,
      patternId: source.patternId,
    };
    return acc;
  }, {} as DesignState);
}

export function mergeWithDefaultDesignState(partial: Partial<DesignState>): DesignState {
  const defaults = createDefaultDesignState();

  MANAGED_MATERIAL_ORDER.forEach((key) => {
    const incoming = partial[key];
    if (!incoming) {
      return;
    }

    defaults[key] = {
      colorHex: incoming.colorHex ?? defaults[key].colorHex,
      finish: incoming.finish ?? defaults[key].finish,
      patternId: incoming.patternId ?? defaults[key].patternId,
    };
  });

  return defaults;
}

export function cloneDesignState(state: DesignState): DesignState {
  return MANAGED_MATERIAL_ORDER.reduce<DesignState>((acc, key) => {
    const value = state[key];
    acc[key] = {
      colorHex: value.colorHex,
      finish: value.finish,
      patternId: value.patternId,
    };
    return acc;
  }, {} as DesignState);
}
