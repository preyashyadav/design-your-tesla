import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeWithDefaultDesignState } from '../config/designDefaults';
import type { DesignState, DesignStatus, SavedDesign } from '../types/design';

const STORAGE_KEY = 'design-your-tesla:saved-designs:v1';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toSavedDesign(value: unknown): SavedDesign | null {
  if (!isObject(value)) {
    return null;
  }

  const id = value.id;
  const name = value.name;
  const createdAt = value.createdAt;
  const materials = value.materials;
  const updatedAt = value.updatedAt;
  const status = value.status;
  const rejectionReason = value.rejectionReason;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof createdAt !== 'string' ||
    !isObject(materials)
  ) {
    return null;
  }

  const normalizedMaterials = mergeWithDefaultDesignState(materials as Partial<DesignState>);
  return {
    createdAt,
    id,
    materials: normalizedMaterials,
    name,
    rejectionReason: typeof rejectionReason === 'string' ? rejectionReason : undefined,
    status: isDesignStatus(status) ? status : 'DRAFT',
    updatedAt: typeof updatedAt === 'string' ? updatedAt : undefined,
  };
}

function isDesignStatus(value: unknown): value is DesignStatus {
  return (
    value === 'DRAFT' ||
    value === 'SUBMITTED' ||
    value === 'APPROVED' ||
    value === 'REJECTED'
  );
}

export async function loadSavedDesigns(): Promise<SavedDesign[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.reduce<SavedDesign[]>((acc, item) => {
      const design = toSavedDesign(item);
      if (design) {
        acc.push(design);
      }
      return acc;
    }, []);
  } catch {
    return [];
  }
}

export async function persistSavedDesigns(designs: SavedDesign[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
}
