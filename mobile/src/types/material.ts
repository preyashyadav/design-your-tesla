import type { Material } from 'three';

export type MaterialOption = {
  id: string;
  name: string;
  detail?: string;
};

export type MaterialEntry = MaterialOption & {
  material: Material;
};
