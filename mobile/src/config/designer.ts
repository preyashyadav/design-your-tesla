export type ManagedMaterialKey =
  | 'material_1'
  | 'material_3'
  | 'material_5'
  | 'material_6'
  | 'material_7'
  | 'material_8'
  | 'material_9';

export type LookMode = 'cyber' | 'stealth' | 'custom';

export type MaterialScheme = Partial<Record<ManagedMaterialKey, string>>;

export const MANAGED_MATERIAL_ORDER: ManagedMaterialKey[] = [
  'material_1',
  'material_3',
  'material_5',
  'material_6',
  'material_7',
  'material_8',
  'material_9',
];

export const MANAGED_MATERIAL_META: Record<
  ManagedMaterialKey,
  {
    name: string;
    detail: string;
  }
> = {
  material_1: {
    name: 'Hooks, Hitch & Mud Guards',
    detail: 'Tow hitch cover, front hooks, and tire splash guards',
  },
  material_3: {
    name: 'Glass Set',
    detail: 'Windshield, roof glass, and door glass',
  },
  material_5: {
    name: 'Window & Door Frames',
    detail: 'Trim and surrounding frame pieces',
  },
  material_6: {
    name: 'Cargo Bed',
    detail: 'Rear bed panel and inner bed walls',
  },
  material_7: {
    name: 'Wheel Covers',
    detail: 'Wheel cover face and trims',
  },
  material_8: {
    name: 'Tires',
    detail: 'Rubber tire material',
  },
  material_9: {
    name: 'Body Paint',
    detail: 'Main Tesla body panels',
  },
};

export const MODERN_CUSTOM_PALETTE: string[] = [
  '#121418',
  '#1E232B',
  '#2C3542',
  '#3D4B5E',
  '#8A111E',
  '#B1162A',
  '#BFC7D3',
  '#E2E7EF',
];

export const DEFAULT_BLACK_SCHEME: MaterialScheme = {
  material_1: '#8A111E',
  material_3: '#1A1E28',
  material_5: '#12151C',
  material_6: '#202630',
  material_7: '#2B303A',
  material_8: '#1A1A1A',
  material_9: '#131417',
};

export const CYBER_SCHEME: MaterialScheme = {
  material_1: '#FF173B',
  material_3: '#0F131B',
  material_5: '#141922',
  material_6: '#1A202A',
  material_7: '#2A323E',
  material_8: '#0A0C10',
  material_9: '#050608',
};

export const STEALTH_SCHEME: MaterialScheme = {
  material_1: '#8E1824',
  material_3: '#1D2733',
  material_5: '#2E3A48',
  material_6: '#465769',
  material_7: '#8A96A5',
  material_8: '#1B1E24',
  material_9: '#CCD3DC',
};

export function toManagedMaterialKey(materialName: string): ManagedMaterialKey | null {
  const normalized = materialName.trim().toLowerCase();
  const match = normalized.match(/material[\s_.-]?(\d+)/i);
  if (!match) {
    return null;
  }

  const key = `material_${match[1]}` as ManagedMaterialKey;
  return MANAGED_MATERIAL_META[key] ? key : null;
}

export function isManagedMaterialKey(value: string): value is ManagedMaterialKey {
  return Boolean(MANAGED_MATERIAL_META[value as ManagedMaterialKey]);
}
