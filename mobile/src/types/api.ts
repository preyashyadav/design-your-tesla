import type { DesignState, DesignStatus, FinishType, PatternId, SavedDesign } from './design';

export type UserProfile = {
  email: string;
  id: string;
};

export type CatalogMaterial = {
  detail?: string;
  key: string;
  name: string;
};

export type CatalogModel = {
  allowedFinishes: FinishType[];
  allowedPatternIds: PatternId[];
  id: string;
  materials: CatalogMaterial[];
  name: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
};

export type LoginRequest = RegisterRequest;

export type RegisterResponse = {
  createdAt: string;
  email: string;
  id: string;
};

export type LoginResponse = {
  token: string;
};

export type DesignRecordDTO = {
  createdAt: string;
  id: string;
  name: string;
  rejectionReason?: string;
  selections: DesignState;
  status: DesignStatus;
  updatedAt: string;
};

export type CreateDesignRequest = {
  name: string;
  selections: DesignState;
};

export type ListDesignsResponse = {
  designs: DesignRecordDTO[];
};

function normalizeStatus(status: string | undefined): DesignStatus {
  if (status === 'APPROVED' || status === 'SUBMITTED' || status === 'REJECTED') {
    return status;
  }
  return 'DRAFT';
}

export function toSavedDesign(record: DesignRecordDTO): SavedDesign {
  return {
    createdAt: record.createdAt,
    id: record.id,
    materials: record.selections,
    name: record.name,
    rejectionReason: record.rejectionReason,
    status: normalizeStatus(record.status),
    updatedAt: record.updatedAt,
  };
}
