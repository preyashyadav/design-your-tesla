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

export const DEFAULT_MATERIAL_KEYS: string[] = [
  'material_1',
  'material_3',
  'material_5',
  'material_6',
  'material_7',
  'material_8',
  'material_9',
];

const FALLBACK_CONFIG: MaterialDesignConfig = {
  colorHex: '#111317',
  finish: 'GLOSS',
  patternId: 'NONE',
};

const DEFAULT_BY_PART: Record<string, MaterialDesignConfig> = {
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

export function getDefaultMaterialConfig(materialKey?: string): MaterialDesignConfig {
  const source = materialKey ? DEFAULT_BY_PART[materialKey] : undefined;
  const base = source ?? FALLBACK_CONFIG;
  return {
    colorHex: base.colorHex,
    finish: base.finish,
    patternId: base.patternId,
  };
}

export function createDefaultDesignState(materialKeys: string[] = DEFAULT_MATERIAL_KEYS): DesignState {
  return materialKeys.reduce<DesignState>((acc, key) => {
    acc[key] = getDefaultMaterialConfig(key);
    return acc;
  }, {});
}

export function mergeWithDefaultDesignState(
  partial: Partial<DesignState>,
  materialKeys?: string[],
): DesignState {
  const keys = materialKeys && materialKeys.length > 0 ? materialKeys : Object.keys(partial);
  const defaults = createDefaultDesignState(keys.length > 0 ? keys : DEFAULT_MATERIAL_KEYS);

  keys.forEach((key) => {
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
  return Object.entries(state).reduce<DesignState>((acc, [key, value]) => {
    acc[key] = {
      colorHex: value.colorHex,
      finish: value.finish,
      patternId: value.patternId,
    };
    return acc;
  }, {});
}
