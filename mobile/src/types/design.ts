export type FinishType = 'GLOSS' | 'MATTE';
export type PatternId = 'NONE' | 'PATTERN_1' | 'PATTERN_2' | 'PATTERN_3';

export type MaterialDesignConfig = {
  colorHex: string;
  finish: FinishType;
  patternId: PatternId;
};

export type DesignState = Record<string, MaterialDesignConfig>;

export type DesignStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type SavedDesign = {
  createdAt: string;
  id: string;
  materials: DesignState;
  name: string;
  rejectionReason?: string;
  status: DesignStatus;
  updatedAt?: string;
};
