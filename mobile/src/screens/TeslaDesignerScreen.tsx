import { Asset } from 'expo-asset';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Material } from 'three';
import {
  CYBER_SCHEME,
  DEFAULT_BLACK_SCHEME,
  MANAGED_MATERIAL_META,
  MANAGED_MATERIAL_ORDER,
  MODERN_CUSTOM_PALETTE,
  STEALTH_SCHEME,
  toManagedMaterialKey,
  type LookMode,
  type ManagedMaterialKey,
  type MaterialScheme,
} from '../config/designer';
import { ColorControls } from '../components/ColorControls';
import { MaterialList } from '../components/MaterialList';
import { ModelCanvas } from '../components/ModelCanvas';
import type { MaterialEntry, MaterialOption } from '../types/material';
import { applyMaterialFinish, materialHasColor, normalizeHex } from '../utils/materials';

const MODEL_ASSET = require('../../assets/tesla_cybertruk_low_poly.glb');

type ManagedMaterialOption = MaterialOption & {
  key: ManagedMaterialKey;
};

export function TeslaDesignerScreen() {
  const materialLookupRef = useRef<Record<string, Material>>({});
  const hasAppliedInitialLookRef = useRef(false);

  const [modelUri, setModelUri] = useState<string | null>(null);
  const [materials, setMaterials] = useState<ManagedMaterialOption[]>([]);
  const [mode, setMode] = useState<LookMode>('custom');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState('#131417');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function prepareModel() {
      try {
        const asset = Asset.fromModule(MODEL_ASSET);
        await asset.downloadAsync();
        if (!cancelled) {
          setModelUri(asset.localUri ?? asset.uri);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load model';
          setLoadError(message);
        }
      }
    }

    void prepareModel();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyColorById = useCallback((materialId: string, colorCandidate: string) => {
    const normalized = normalizeHex(colorCandidate);
    if (!normalized) {
      return;
    }

    const material = materialLookupRef.current[materialId];
    if (!material || !materialHasColor(material)) {
      return;
    }

    material.color.set(normalized);
    material.needsUpdate = true;
  }, []);

  const applyScheme = useCallback(
    (scheme: MaterialScheme, targetMaterials: ManagedMaterialOption[]) => {
      targetMaterials.forEach((materialOption) => {
        const color = scheme[materialOption.key];
        if (!color) {
          return;
        }
        applyColorById(materialOption.id, color);
      });
    },
    [applyColorById],
  );

  const getDefaultSelectedMaterialId = useCallback(
    (options: ManagedMaterialOption[]): string | null => {
      if (options.length === 0) {
        return null;
      }
      return options.find((option) => option.key === 'material_9')?.id ?? options[0].id;
    },
    [],
  );

  const handleMaterialsExtracted = useCallback(
    (entries: MaterialEntry[]) => {
      materialLookupRef.current = entries.reduce<Record<string, Material>>((acc, entry) => {
        acc[entry.id] = entry.material;
        return acc;
      }, {});

      const byKey = new Map<ManagedMaterialKey, MaterialEntry>();
      entries.forEach((entry) => {
        const key = toManagedMaterialKey(entry.name);
        if (!key || byKey.has(key)) {
          return;
        }
        byKey.set(key, entry);
      });

      const mappedOptions: ManagedMaterialOption[] = MANAGED_MATERIAL_ORDER.reduce<
        ManagedMaterialOption[]
      >((acc, key) => {
        const materialEntry = byKey.get(key);
        if (!materialEntry) {
          return acc;
        }

        const meta = MANAGED_MATERIAL_META[key];
        applyMaterialFinish(materialEntry.material, key);
        acc.push({
          id: materialEntry.id,
          key,
          name: meta.name,
          detail: meta.detail,
        });
        return acc;
      }, []);

      setMaterials(mappedOptions);

      setSelectedMaterialId((currentId) => {
        if (currentId && mappedOptions.some((option) => option.id === currentId)) {
          return currentId;
        }
        return getDefaultSelectedMaterialId(mappedOptions);
      });

      if (!hasAppliedInitialLookRef.current) {
        if (mode === 'cyber') {
          applyScheme(CYBER_SCHEME, mappedOptions);
        } else if (mode === 'stealth') {
          applyScheme(STEALTH_SCHEME, mappedOptions);
        } else {
          applyScheme(DEFAULT_BLACK_SCHEME, mappedOptions);
        }
        hasAppliedInitialLookRef.current = true;
      }
    },
    [applyScheme, getDefaultSelectedMaterialId, mode],
  );

  useEffect(() => {
    if (!selectedMaterialId) {
      return;
    }
    const material = materialLookupRef.current[selectedMaterialId];
    if (!material || !materialHasColor(material)) {
      return;
    }
    setHexInput(`#${material.color.getHexString()}`.toUpperCase());
  }, [selectedMaterialId]);

  const handleHexInputChange = useCallback(
    (value: string) => {
      if (mode !== 'custom' || !selectedMaterialId) {
        return;
      }
      setHexInput(value);
      applyColorById(selectedMaterialId, value);
    },
    [applyColorById, mode, selectedMaterialId],
  );

  const handlePaletteSelect = useCallback(
    (hex: string) => {
      if (mode !== 'custom' || !selectedMaterialId) {
        return;
      }
      setHexInput(hex);
      applyColorById(selectedMaterialId, hex);
    },
    [applyColorById, mode, selectedMaterialId],
  );

  const handleModeChange = useCallback(
    (nextMode: LookMode) => {
      setMode(nextMode);
      if (nextMode === 'cyber') {
        applyScheme(CYBER_SCHEME, materials);
        return;
      }
      if (nextMode === 'stealth') {
        applyScheme(STEALTH_SCHEME, materials);
      }
    },
    [applyScheme, materials],
  );

  const handleWheelColorChange = useCallback(
    (candidate: string) => {
      if (mode !== 'custom' || !selectedMaterialId) {
        return;
      }

      const normalized = normalizeHex(candidate);
      if (!normalized) {
        return;
      }

      setHexInput(normalized);
      applyColorById(selectedMaterialId, normalized);
    },
    [applyColorById, mode, selectedMaterialId],
  );

  const selectedMaterialName = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId)?.name ?? null,
    [materials, selectedMaterialId],
  );

  return (
    <View style={styles.safeArea}>
      <View style={styles.screen}>
        <Text style={styles.title}>Design Your Tesla</Text>
        <Text style={styles.subtitle}>Showroom preview with rotate + pinch zoom</Text>

        <View style={styles.viewerCard}>
          {modelUri ? (
            <ModelCanvas modelUri={modelUri} onMaterialsExtracted={handleMaterialsExtracted} />
          ) : (
            <View style={styles.loader}>
              <ActivityIndicator color="#4FA6FF" />
              <Text style={styles.loaderText}>{loadError ?? 'Loading 3D model...'}</Text>
            </View>
          )}
        </View>

        <View style={styles.controlsCard}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.controlsContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {mode === 'custom' ? (
              <>
                <Text style={styles.sectionTitle}>Material Targets</Text>
                <MaterialList
                  materials={materials}
                  onSelect={setSelectedMaterialId}
                  selectedMaterialId={selectedMaterialId}
                />
                <View style={styles.spacer} />
              </>
            ) : null}

            <ColorControls
              hexInput={hexInput}
              isCustomMode={mode === 'custom'}
              mode={mode}
              onHexInputChange={handleHexInputChange}
              onModeChange={handleModeChange}
              onPaletteSelect={handlePaletteSelect}
              onWheelColorChange={handleWheelColorChange}
              palette={MODERN_CUSTOM_PALETTE}
              selectedMaterialName={selectedMaterialName}
            />
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DDE6',
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 380,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  controlsContent: {
    gap: 8,
    paddingBottom: 14,
  },
  loader: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  loaderText: {
    color: '#667085',
    fontSize: 13,
  },
  safeArea: {
    backgroundColor: '#EDF1F6',
    flex: 1,
    paddingTop: 16,
  },
  screen: {
    flex: 1,
    gap: 12,
    padding: 12,
  },
  sectionTitle: {
    color: '#2A3342',
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    height: 6,
  },
  subtitle: {
    color: '#5A6372',
    fontSize: 13,
    marginTop: -4,
  },
  title: {
    color: '#121722',
    fontSize: 26,
    fontWeight: '700',
  },
  viewerCard: {
    backgroundColor: '#DDE4EC',
    borderColor: '#C8D0DB',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 260,
    overflow: 'hidden',
    padding: 6,
  },
});
