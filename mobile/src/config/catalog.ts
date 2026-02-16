import { MANAGED_MATERIAL_META, MANAGED_MATERIAL_ORDER } from './designer';
import type { CatalogModel } from '../types/api';

export const FALLBACK_CATALOG_MODEL: CatalogModel = {
  allowedFinishes: ['GLOSS', 'MATTE'],
  allowedPatternIds: ['NONE', 'PATTERN_1', 'PATTERN_2', 'PATTERN_3'],
  id: 'tesla-cybertruck-low-poly',
  materials: MANAGED_MATERIAL_ORDER.map((key) => ({
    detail: MANAGED_MATERIAL_META[key].detail,
    key,
    name: MANAGED_MATERIAL_META[key].name,
  })),
  name: 'Tesla Cybertruck Low Poly',
};
