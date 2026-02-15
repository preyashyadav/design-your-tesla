import type { ManagedMaterialKey } from '../config/designer';

export type FinishType = 'GLOSS' | 'MATTE';
export type PatternId = 'NONE' | 'PATTERN_1' | 'PATTERN_2' | 'PATTERN_3';

export type MaterialDesignConfig = {
  colorHex: string;
  finish: FinishType;
  patternId: PatternId;
};

export type DesignState = Record<ManagedMaterialKey, MaterialDesignConfig>;

export type SavedDesign = {
  createdAt: string;
  id: string;
  materials: DesignState;
  name: string;
};
