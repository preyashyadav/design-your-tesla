import { Asset } from 'expo-asset';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Material } from 'three';
import { MaterialList } from '../components/MaterialList';
import { ModelCanvas } from '../components/ModelCanvas';
import { COLOR_SUGGESTIONS } from '../config/designDefaults';
import {
  MANAGED_MATERIAL_META,
  MANAGED_MATERIAL_ORDER,
  isManagedMaterialKey,
  toManagedMaterialKey,
  type ManagedMaterialKey,
} from '../config/designer';
import type { DesignState, FinishType, MaterialDesignConfig, PatternId } from '../types/design';
import type { MaterialEntry, MaterialOption } from '../types/material';
import { applyMaterialDesign } from '../utils/materialDesignApplier';

const MODEL_ASSET = require('../../assets/tesla_cybertruk_low_poly.glb');
const MODEL_CREDIT = {
  authorName: 'Igor Tretyakov',
  authorUrl: 'https://sketchfab.com/vdv77',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
  sourceUrl:
    'https://sketchfab.com/3d-models/tesla-cybertruk-low-poly-e3558b991e75418cb45624fab4d980e5',
  title: 'Tesla cybertruk low poly',
} as const;

const FINISH_OPTIONS: FinishType[] = ['GLOSS', 'MATTE'];
const PATTERN_OPTIONS: PatternId[] = ['NONE', 'PATTERN_1', 'PATTERN_2', 'PATTERN_3'];

type ConfiguratorScreenProps = {
  designState: DesignState;
  onResetDesign: () => void;
  onSaveDesign: (name: string) => Promise<void>;
  onUpdateDesignState: (updater: (current: DesignState) => DesignState) => void;
};

export function ConfiguratorScreen({
  designState,
  onResetDesign,
  onSaveDesign,
  onUpdateDesignState,
}: ConfiguratorScreenProps) {
  const materialLookupRef = useRef<Partial<Record<ManagedMaterialKey, Material>>>({});
  const [modelUri, setModelUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partOptions, setPartOptions] = useState<MaterialOption[]>([]);
  const [selectedPart, setSelectedPart] = useState<ManagedMaterialKey>('material_9');
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [bindingsVersion, setBindingsVersion] = useState(0);
  const { width } = useWindowDimensions();

  const isWideLayout = width >= 900;

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
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

    void loadModel();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCurrentDesignState = useCallback(() => {
    MANAGED_MATERIAL_ORDER.forEach((partKey) => {
      const material = materialLookupRef.current[partKey];
      if (!material) {
        return;
      }
      applyMaterialDesign(material, partKey, designState[partKey]);
    });
  }, [designState]);

  const handleMaterialsExtracted = useCallback(
    (entries: MaterialEntry[]) => {
      const byPart = new Map<ManagedMaterialKey, MaterialEntry>();
      entries.forEach((entry) => {
        const key = toManagedMaterialKey(entry.name);
        if (!key || byPart.has(key)) {
          return;
        }
        byPart.set(key, entry);
      });

      const options: MaterialOption[] = [];
      const nextLookup: Partial<Record<ManagedMaterialKey, Material>> = {};

      MANAGED_MATERIAL_ORDER.forEach((partKey) => {
        const entry = byPart.get(partKey);
        if (!entry) {
          return;
        }

        nextLookup[partKey] = entry.material;
        options.push({
          id: partKey,
          name: MANAGED_MATERIAL_META[partKey].name,
          detail: MANAGED_MATERIAL_META[partKey].detail,
        });
      });

      materialLookupRef.current = nextLookup;
      setPartOptions(options);
      setBindingsVersion((value) => value + 1);

      if (!nextLookup[selectedPart] && options[0] && isManagedMaterialKey(options[0].id)) {
        setSelectedPart(options[0].id);
      }
    },
    [selectedPart],
  );

  useEffect(() => {
    if (bindingsVersion === 0) {
      return;
    }
    applyCurrentDesignState();
  }, [applyCurrentDesignState, bindingsVersion, designState]);

  const selectedConfig = useMemo<MaterialDesignConfig>(
    () => designState[selectedPart],
    [designState, selectedPart],
  );

  const updateSelectedPart = useCallback(
    (patch: Partial<MaterialDesignConfig>) => {
      const part = selectedPart;
      onUpdateDesignState((current) => ({
        ...current,
        [part]: {
          ...current[part],
          ...patch,
        },
      }));
    },
    [onUpdateDesignState, selectedPart],
  );

  const handleColorInput = useCallback(
    (value: string) => {
      updateSelectedPart({ colorHex: value.toUpperCase() });
    },
    [updateSelectedPart],
  );

  const handleSave = useCallback(async () => {
    const candidateName = saveName.trim();
    if (!candidateName || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onSaveDesign(candidateName);
      setSaveName('');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onSaveDesign, saveName]);

  const openExternalLink = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Design Your Tesla</Text>
      <Text style={styles.subtitle}>Configurator</Text>

      <View style={[styles.layout, isWideLayout ? styles.layoutWide : styles.layoutStacked]}>
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

        <View style={[styles.panelCard, isWideLayout ? styles.panelWide : styles.panelStacked]}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.panelContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Parts</Text>
            <MaterialList
              materials={partOptions}
              onSelect={(id) => {
                if (isManagedMaterialKey(id)) {
                  setSelectedPart(id);
                }
              }}
              selectedMaterialId={selectedPart}
            />

            <Text style={styles.sectionTitle}>Color</Text>
            <View style={styles.paletteRow}>
              {COLOR_SUGGESTIONS.map((colorHex) => (
                <Pressable
                  key={colorHex}
                  onPress={() => updateSelectedPart({ colorHex })}
                  style={[styles.swatch, { backgroundColor: colorHex }]}
                />
              ))}
            </View>

            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={handleColorInput}
              placeholder="#RRGGBB"
              placeholderTextColor="#7E8597"
              style={styles.input}
              value={selectedConfig.colorHex}
            />

            <Text style={styles.sectionTitle}>Finish</Text>
            <View style={styles.optionRow}>
              {FINISH_OPTIONS.map((finish) => {
                const active = selectedConfig.finish === finish;
                return (
                  <Pressable
                    key={finish}
                    onPress={() => updateSelectedPart({ finish })}
                    style={[styles.optionButton, active && styles.optionButtonActive]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {finish}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Pattern</Text>
            <View style={styles.optionRow}>
              {PATTERN_OPTIONS.map((patternId) => {
                const active = selectedConfig.patternId === patternId;
                return (
                  <Pressable
                    key={patternId}
                    onPress={() => updateSelectedPart({ patternId })}
                    style={[styles.optionButton, active && styles.optionButtonActive]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {patternId.replace('PATTERN_', 'P')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Save</Text>
            <TextInput
              autoCorrect={false}
              onChangeText={setSaveName}
              placeholder="Design name"
              placeholderTextColor="#7E8597"
              style={styles.input}
              value={saveName}
            />

            <View style={styles.actionRow}>
              <Pressable
                disabled={isSaving || saveName.trim().length === 0}
                onPress={handleSave}
                style={[
                  styles.actionButton,
                  (isSaving || saveName.trim().length === 0) && styles.disabled,
                ]}
              >
                <Text style={styles.actionText}>{isSaving ? 'Saving...' : 'Save Design'}</Text>
              </Pressable>

              <Pressable onPress={onResetDesign} style={[styles.actionButton, styles.resetButton]}>
                <Text style={styles.actionText}>Reset Defaults</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Model Credit</Text>
            <View style={styles.creditCard}>
              <Text style={styles.creditText}>{MODEL_CREDIT.title}</Text>
              <Text style={styles.creditText}>by {MODEL_CREDIT.authorName}</Text>
              <View style={styles.creditLinkRow}>
                <Pressable onPress={() => openExternalLink(MODEL_CREDIT.sourceUrl)}>
                  <Text style={styles.creditLink}>Source</Text>
                </Pressable>
                <Pressable onPress={() => openExternalLink(MODEL_CREDIT.authorUrl)}>
                  <Text style={styles.creditLink}>Author</Text>
                </Pressable>
                <Pressable onPress={() => openExternalLink(MODEL_CREDIT.licenseUrl)}>
                  <Text style={styles.creditLink}>{MODEL_CREDIT.licenseName}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#101317',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionText: {
    color: '#F5F8FF',
    fontSize: 13,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  creditCard: {
    backgroundColor: '#F5F7FA',
    borderColor: '#D8DEE8',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  creditLink: {
    color: '#1C4EA4',
    fontSize: 12,
    fontWeight: '700',
  },
  creditLinkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  creditText: {
    color: '#3E4A61',
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#F7F8FA',
    borderColor: '#D8DCE3',
    borderRadius: 10,
    borderWidth: 1,
    color: '#1E2532',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  layout: {
    flex: 1,
    gap: 12,
  },
  layoutStacked: {
    flexDirection: 'column',
  },
  layoutWide: {
    flexDirection: 'row',
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
  optionButton: {
    backgroundColor: '#F2F4F7',
    borderColor: '#D8DCE3',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonActive: {
    backgroundColor: '#101317',
    borderColor: '#101317',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionText: {
    color: '#4C5669',
    fontSize: 12,
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#F5F7FB',
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  panelCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DDE6',
    borderRadius: 14,
    borderWidth: 1,
  },
  panelContent: {
    gap: 10,
    padding: 14,
  },
  panelStacked: {
    maxHeight: 410,
  },
  panelWide: {
    flex: 0,
    width: 360,
  },
  resetButton: {
    backgroundColor: '#2B3140',
  },
  screen: {
    flex: 1,
    gap: 10,
    padding: 12,
  },
  sectionTitle: {
    color: '#2A3342',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#5A6372',
    fontSize: 13,
    marginBottom: 2,
  },
  swatch: {
    borderColor: '#C9CFDA',
    borderRadius: 14,
    borderWidth: 1,
    height: 30,
    width: 30,
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
