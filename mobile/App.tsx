import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  cloneDesignState,
  createDefaultDesignState,
  mergeWithDefaultDesignState,
} from './src/config/designDefaults';
import { ConfiguratorScreen } from './src/screens/ConfiguratorScreen';
import { SavedDesignsScreen } from './src/screens/SavedDesignsScreen';
import { loadSavedDesigns, persistSavedDesigns } from './src/storage/designStorage';
import type { DesignState, SavedDesign } from './src/types/design';

type AppTab = 'CONFIGURATOR' | 'SAVED';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('CONFIGURATOR');
  const [designState, setDesignState] = useState<DesignState>(createDefaultDesignState());
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrateStorage() {
      try {
        const loaded = await loadSavedDesigns();
        if (!cancelled) {
          setSavedDesigns(loaded);
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateStorage();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdateDesignState = useCallback((updater: (current: DesignState) => DesignState) => {
    setDesignState((current) => mergeWithDefaultDesignState(updater(current)));
  }, []);

  const handleReset = useCallback(() => {
    setDesignState(createDefaultDesignState());
  }, []);

  const handleSaveDesign = useCallback(
    async (name: string) => {
      const safeName = name.trim() || `Design ${savedDesigns.length + 1}`;
      const nextDesign: SavedDesign = {
        createdAt: new Date().toISOString(),
        id: `${Date.now()}`,
        materials: cloneDesignState(designState),
        name: safeName,
      };

      const nextSavedDesigns = [nextDesign, ...savedDesigns];
      setSavedDesigns(nextSavedDesigns);
      await persistSavedDesigns(nextSavedDesigns);
    },
    [designState, savedDesigns],
  );

  const handleApplyDesign = useCallback((design: SavedDesign) => {
    setDesignState(mergeWithDefaultDesignState(design.materials));
    setActiveTab('CONFIGURATOR');
  }, []);

  const tabContent = useMemo(() => {
    if (activeTab === 'SAVED') {
      return <SavedDesignsScreen onApplyDesign={handleApplyDesign} savedDesigns={savedDesigns} />;
    }

    return (
      <ConfiguratorScreen
        designState={designState}
        onResetDesign={handleReset}
        onSaveDesign={handleSaveDesign}
        onUpdateDesignState={handleUpdateDesignState}
      />
    );
  }, [
    activeTab,
    designState,
    handleApplyDesign,
    handleReset,
    handleSaveDesign,
    handleUpdateDesignState,
    savedDesigns,
  ]);

  if (isHydrating) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#111317" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setActiveTab('CONFIGURATOR')}
          style={[styles.tabButton, activeTab === 'CONFIGURATOR' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'CONFIGURATOR' && styles.tabTextActive]}>
            Configurator
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('SAVED')}
          style={[styles.tabButton, activeTab === 'SAVED' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'SAVED' && styles.tabTextActive]}>
            Saved Designs ({savedDesigns.length})
          </Text>
        </Pressable>
      </View>

      {tabContent}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#EDF1F6',
    flex: 1,
    justifyContent: 'center',
  },
  root: {
    backgroundColor: '#EDF1F6',
    flex: 1,
    paddingTop: 16,
  },
  tabActive: {
    backgroundColor: '#101317',
    borderColor: '#101317',
  },
  tabButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D2D8E1',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  tabText: {
    color: '#42506A',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#F6F8FC',
  },
});
