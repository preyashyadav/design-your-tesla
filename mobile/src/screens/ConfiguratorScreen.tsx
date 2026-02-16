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
import { COLOR_SUGGESTIONS, getDefaultMaterialConfig } from '../config/designDefaults';
import type { CatalogModel } from '../types/api';
import type {
  DesignState,
  DesignStatus,
  FinishType,
  MaterialDesignConfig,
  PatternId,
} from '../types/design';
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

type ConfiguratorScreenProps = {
  catalog: CatalogModel;
  currentDesignReason?: string;
  currentDesignStatus?: DesignStatus;
  designState: DesignState;
  onResetDesign: () => void;
  onSaveDesign: (name: string) => Promise<boolean>;
  onUpdateDesignState: (updater: (current: DesignState) => DesignState) => void;
};

function statusStyle(status: DesignStatus | undefined): {
  container: { backgroundColor: string; borderColor: string };
  text: { color: string };
} {
  if (status === 'APPROVED') {
    return {
      container: { backgroundColor: '#E7F6EC', borderColor: '#8FC9A0' },
      text: { color: '#1E6A36' },
    };
  }
  if (status === 'SUBMITTED') {
    return {
      container: { backgroundColor: '#EEF2FA', borderColor: '#B2C1E0' },
      text: { color: '#3C527E' },
    };
  }
  if (status === 'REJECTED') {
    return {
      container: { backgroundColor: '#FDECEF', borderColor: '#F1A3B0' },
      text: { color: '#8E1E31' },
    };
  }

  return {
    container: { backgroundColor: '#F3F4F7', borderColor: '#CDD3DE' },
    text: { color: '#4C5565' },
  };
}

function normalizeMaterialKey(materialName: string): string {
  const trimmed = materialName.trim().toLowerCase();
  const match = trimmed.match(/material[\s_.-]?(\d+)/i);
  if (!match) {
    return trimmed;
  }
  return `material_${match[1]}`;
}

function getPreferredMaterialKey(catalog: CatalogModel): string | null {
  if (catalog.materials.length === 0) {
    return null;
  }

  const bodyMaterial =
    catalog.materials.find((item) => item.key === 'material_9') ??
    catalog.materials.find((item) => item.name.toLowerCase().includes('body'));
  return bodyMaterial?.key ?? catalog.materials[0].key;
}

export function ConfiguratorScreen({
  catalog,
  currentDesignReason,
  currentDesignStatus,
  designState,
  onResetDesign,
  onSaveDesign,
  onUpdateDesignState,
}: ConfiguratorScreenProps) {
  const materialLookupRef = useRef<Record<string, Material>>({});
  const [modelUri, setModelUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partOptions, setPartOptions] = useState<MaterialOption[]>([]);
  const [selectedPart, setSelectedPart] = useState<string | null>(getPreferredMaterialKey(catalog));
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [bindingsVersion, setBindingsVersion] = useState(0);
  const { width } = useWindowDimensions();

  const isWideLayout = width >= 900;
  const statusAppearance = statusStyle(currentDesignStatus);
  const catalogByKey = useMemo(
    () => new Map(catalog.materials.map((item) => [item.key, item])),
    [catalog.materials],
  );
  const catalogKeys = useMemo(() => catalog.materials.map((item) => item.key), [catalog.materials]);
  const finishOptions: FinishType[] =
    catalog.allowedFinishes.length > 0 ? catalog.allowedFinishes : ['GLOSS', 'MATTE'];
  const basePatternOptions: PatternId[] =
    catalog.allowedPatternIds.length > 0
      ? catalog.allowedPatternIds
      : ['NONE', 'PATTERN_1', 'PATTERN_2', 'PATTERN_3'];
  const selectedPartMeta = selectedPart ? catalogByKey.get(selectedPart) : undefined;
  const isGlassSelected =
    selectedPart === 'material_3' ||
    selectedPartMeta?.name.toLowerCase().includes('glass') ||
    selectedPartMeta?.detail?.toLowerCase().includes('glass');
  const patternOptions: PatternId[] = isGlassSelected ? ['NONE'] : basePatternOptions;

  useEffect(() => {
    setSelectedPart((current) => {
      if (current && catalogByKey.has(current)) {
        return current;
      }
      return getPreferredMaterialKey(catalog);
    });
  }, [catalog, catalogByKey]);

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
    catalogKeys.forEach((partKey) => {
      const material = materialLookupRef.current[partKey];
      if (!material) {
        return;
      }
      const config = designState[partKey] ?? getDefaultMaterialConfig(partKey);
      applyMaterialDesign(material, partKey, config);
    });
  }, [catalogKeys, designState]);

  const handleMaterialsExtracted = useCallback(
    (entries: MaterialEntry[]) => {
      const byPart = new Map<string, MaterialEntry>();

      entries.forEach((entry) => {
        const key = normalizeMaterialKey(entry.name);
        if (!catalogByKey.has(key) || byPart.has(key)) {
          return;
        }
        byPart.set(key, entry);
      });

      const options: MaterialOption[] = [];
      const nextLookup: Record<string, Material> = {};

      catalog.materials.forEach((materialMeta) => {
        const entry = byPart.get(materialMeta.key);
        if (!entry) {
          return;
        }

        nextLookup[materialMeta.key] = entry.material;
        options.push({
          detail: materialMeta.detail,
          id: materialMeta.key,
          name: materialMeta.name,
        });
      });

      materialLookupRef.current = nextLookup;
      setPartOptions(options);
      setBindingsVersion((value) => value + 1);

      setSelectedPart((current) => {
        if (current && nextLookup[current]) {
          return current;
        }
        return options[0]?.id ?? getPreferredMaterialKey(catalog);
      });
    },
    [catalog, catalogByKey],
  );

  useEffect(() => {
    if (bindingsVersion === 0) {
      return;
    }
    applyCurrentDesignState();
  }, [applyCurrentDesignState, bindingsVersion, designState]);

  const selectedConfig = useMemo<MaterialDesignConfig>(() => {
    if (!selectedPart) {
      return getDefaultMaterialConfig();
    }
    return designState[selectedPart] ?? getDefaultMaterialConfig(selectedPart);
  }, [designState, selectedPart]);

  useEffect(() => {
    if (!selectedPart || !isGlassSelected) {
      return;
    }
    if (selectedConfig.patternId === 'NONE') {
      return;
    }
    onUpdateDesignState((current) => ({
      ...current,
      [selectedPart]: {
        ...(current[selectedPart] ?? getDefaultMaterialConfig(selectedPart)),
        patternId: 'NONE',
      },
    }));
  }, [isGlassSelected, onUpdateDesignState, selectedConfig.patternId, selectedPart]);

  const updateSelectedPart = useCallback(
    (patch: Partial<MaterialDesignConfig>) => {
      if (!selectedPart) {
        return;
      }
      onUpdateDesignState((current) => ({
        ...current,
        [selectedPart]: {
          ...(current[selectedPart] ?? getDefaultMaterialConfig(selectedPart)),
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
      const saved = await onSaveDesign(candidateName);
      if (saved) {
        setSaveName('');
      }
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
      <View style={[styles.statusBadge, statusAppearance.container]}>
        <Text style={[styles.statusBadgeText, statusAppearance.text]}>
          {currentDesignStatus ?? 'DRAFT'}
        </Text>
      </View>
      {currentDesignStatus === 'REJECTED' && currentDesignReason ? (
        <Text style={styles.rejectionText}>Rejected: {currentDesignReason}</Text>
      ) : null}

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
              onSelect={setSelectedPart}
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
              {finishOptions.map((finish) => {
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
              {patternOptions.map((patternId) => {
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
  disabled: {
    opacity: 0.45,
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
    maxHeight: 470,
  },
  panelWide: {
    flex: 0,
    width: 360,
  },
  resetButton: {
    backgroundColor: '#2B3140',
  },
  rejectionText: {
    color: '#9A2034',
    fontSize: 12,
    marginTop: -4,
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
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
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
