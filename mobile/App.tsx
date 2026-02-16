import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  createDesign,
  fetchCatalogModel,
  fetchMe,
  getApiBaseUrl,
  listDesigns,
  loginUser,
  registerUser,
  submitDesign,
  updateDesign,
} from './src/api/backend';
import { FALLBACK_CATALOG_MODEL } from './src/config/catalog';
import {
  cloneDesignState,
  createDefaultDesignState,
  mergeWithDefaultDesignState,
} from './src/config/designDefaults';
import { AuthScreen } from './src/screens/AuthScreen';
import { ConfiguratorScreen } from './src/screens/ConfiguratorScreen';
import { SavedDesignsScreen } from './src/screens/SavedDesignsScreen';
import { clearAuthToken, loadAuthToken, persistAuthToken } from './src/storage/authStorage';
import { loadSavedDesigns, persistSavedDesigns } from './src/storage/designStorage';
import type { CatalogModel, UserProfile } from './src/types/api';
import type { DesignState, SavedDesign } from './src/types/design';

type AppTab = 'CONFIGURATOR' | 'SAVED';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong';
}

function catalogKeys(catalog: CatalogModel): string[] {
  return catalog.materials.map((item) => item.key);
}

function findGlassMaterialKey(catalog: CatalogModel): string | null {
  const byKey = catalog.materials.find((item) => item.key === 'material_3');
  if (byKey) {
    return byKey.key;
  }

  const byName = catalog.materials.find((item) => {
    const name = item.name.toLowerCase();
    const detail = (item.detail ?? '').toLowerCase();
    return name.includes('glass') || detail.includes('glass');
  });
  return byName?.key ?? null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('CONFIGURATOR');
  const [catalog, setCatalog] = useState<CatalogModel>(FALLBACK_CATALOG_MODEL);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [designState, setDesignState] = useState<DesignState>(
    createDefaultDesignState(catalogKeys(FALLBACK_CATALOG_MODEL)),
  );
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null);
  const [submittingDesignID, setSubmittingDesignID] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateStorageAndAuth() {
      try {
        const [cachedDesigns, storedToken] = await Promise.all([loadSavedDesigns(), loadAuthToken()]);

        if (cancelled) {
          return;
        }

        setSavedDesigns(cachedDesigns);
        setSelectedDesign(cachedDesigns[0] ?? null);

        try {
          const remoteCatalog = await fetchCatalogModel();
          if (!cancelled) {
            setCatalog(remoteCatalog);
            setDesignState((current) =>
              mergeWithDefaultDesignState(current, catalogKeys(remoteCatalog)),
            );
          }
        } catch (error) {
          if (!cancelled) {
            setDataError(`Catalog unavailable: ${toErrorMessage(error)}`);
          }
        }

        if (!storedToken) {
          return;
        }

        try {
          const profile = await fetchMe(storedToken);
          const remoteDesigns = await listDesigns(storedToken);
          if (!cancelled) {
            setAuthToken(storedToken);
            setCurrentUser(profile);
            setSavedDesigns(remoteDesigns);
            setSelectedDesign(remoteDesigns[0] ?? null);
            await persistSavedDesigns(remoteDesigns);
          }
        } catch {
          await clearAuthToken();
          if (!cancelled) {
            setAuthToken(null);
            setCurrentUser(null);
            setSavedDesigns([]);
            setSelectedDesign(null);
          }
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateStorageAndAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDesignState((current) => mergeWithDefaultDesignState(current, catalogKeys(catalog)));
  }, [catalog]);

  const handleUpdateDesignState = useCallback(
    (updater: (current: DesignState) => DesignState) => {
      setDesignState((current) =>
        mergeWithDefaultDesignState(updater(current), catalogKeys(catalog)),
      );
    },
    [catalog],
  );

  const handleReset = useCallback(() => {
    setDesignState(createDefaultDesignState(catalogKeys(catalog)));
  }, [catalog]);

  const handleSaveDesign = useCallback(
    async (name: string) => {
      if (!authToken) {
        setDataError('Please login before saving designs.');
        return false;
      }

      const safeName = name.trim() || `Design ${savedDesigns.length + 1}`;
      try {
        const saved = await createDesign(authToken, {
          materials: cloneDesignState(designState),
          name: safeName,
        });
        const nextSavedDesigns = [saved, ...savedDesigns.filter((item) => item.id !== saved.id)];
        setSavedDesigns(nextSavedDesigns);
        setSelectedDesign(saved);
        setDataError(null);
        await persistSavedDesigns(nextSavedDesigns);
        return true;
      } catch (error) {
        setDataError(`Save failed: ${toErrorMessage(error)}`);
        return false;
      }
    },
    [authToken, designState, savedDesigns],
  );

  const handleApplyDesign = useCallback(
    (design: SavedDesign) => {
      setDesignState(mergeWithDefaultDesignState(design.materials, catalogKeys(catalog)));
      setSelectedDesign(design);
      setActiveTab('CONFIGURATOR');
    },
    [catalog],
  );

  const handleSubmitForApproval = useCallback(
    async (design: SavedDesign) => {
      if (!authToken) {
        setDataError('Please login before submitting designs.');
        return;
      }

      setSubmittingDesignID(design.id);
      try {
        const glassKey = findGlassMaterialKey(catalog);
        let designToSubmit = design;

        if (glassKey) {
          const currentGlass = design.materials[glassKey];
          if (currentGlass && currentGlass.patternId !== 'NONE') {
            const patchedMaterials = cloneDesignState(design.materials);
            patchedMaterials[glassKey] = {
              ...patchedMaterials[glassKey],
              patternId: 'NONE',
            };

            designToSubmit = await updateDesign(authToken, design.id, {
              materials: patchedMaterials,
              name: design.name,
            });
          }
        }

        const submitted = await submitDesign(authToken, designToSubmit.id);
        const nextSavedDesigns = savedDesigns.map((item) =>
          item.id === submitted.id ? submitted : item,
        );
        setSavedDesigns(nextSavedDesigns);
        if (selectedDesign?.id === submitted.id) {
          setSelectedDesign(submitted);
        }
        if (design.id === selectedDesign?.id) {
          setDesignState(mergeWithDefaultDesignState(submitted.materials, catalogKeys(catalog)));
        }
        setDataError(null);
        await persistSavedDesigns(nextSavedDesigns);
      } catch (error) {
        setDataError(`Submit failed: ${toErrorMessage(error)}`);
      } finally {
        setSubmittingDesignID(null);
      }
    },
    [authToken, catalog, savedDesigns, selectedDesign],
  );

  const handleLogin = useCallback(async (email: string, password: string) => {
    setIsAuthSubmitting(true);
    setAuthError(null);
    setDataError(null);

    try {
      const login = await loginUser({ email, password });
      const profile = await fetchMe(login.token);
      const remoteDesigns = await listDesigns(login.token);

      await persistAuthToken(login.token);
      await persistSavedDesigns(remoteDesigns);

      setAuthToken(login.token);
      setCurrentUser(profile);
      setSavedDesigns(remoteDesigns);
      setSelectedDesign(remoteDesigns[0] ?? null);
      setActiveTab('CONFIGURATOR');
    } catch (error) {
      setAuthError(toErrorMessage(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  }, []);

  const handleRegister = useCallback(
    async (email: string, password: string) => {
      setIsAuthSubmitting(true);
      setAuthError(null);

      try {
        await registerUser({ email, password });
      } catch (error) {
        setAuthError(toErrorMessage(error));
        setIsAuthSubmitting(false);
        return;
      }

      setIsAuthSubmitting(false);
      await handleLogin(email, password);
    },
    [handleLogin],
  );

  const handleLogout = useCallback(async () => {
    await clearAuthToken();
    await persistSavedDesigns([]);
    setAuthToken(null);
    setCurrentUser(null);
    setSavedDesigns([]);
    setSelectedDesign(null);
    setDataError(null);
    setAuthError(null);
    setActiveTab('CONFIGURATOR');
    setDesignState(createDefaultDesignState(catalogKeys(catalog)));
  }, [catalog]);

  const tabContent = useMemo(() => {
    if (activeTab === 'SAVED') {
      return (
        <SavedDesignsScreen
          onApplyDesign={handleApplyDesign}
          onSubmitDesign={handleSubmitForApproval}
          savedDesigns={savedDesigns}
          submittingDesignId={submittingDesignID}
        />
      );
    }

    return (
      <ConfiguratorScreen
        catalog={catalog}
        currentDesignReason={selectedDesign?.rejectionReason}
        currentDesignStatus={selectedDesign?.status}
        designState={designState}
        onResetDesign={handleReset}
        onSaveDesign={handleSaveDesign}
        onUpdateDesignState={handleUpdateDesignState}
      />
    );
  }, [
    activeTab,
    catalog,
    designState,
    handleApplyDesign,
    handleReset,
    handleSaveDesign,
    handleSubmitForApproval,
    handleUpdateDesignState,
    selectedDesign?.rejectionReason,
    selectedDesign?.status,
    savedDesigns,
    submittingDesignID,
  ]);

  if (isHydrating) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#111317" />
      </View>
    );
  }

  if (!authToken || !currentUser) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen
          errorMessage={authError}
          isSubmitting={isAuthSubmitting}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Logged in as {currentUser.email}</Text>
          <Text style={styles.headerMeta}>API: {getApiBaseUrl()}</Text>
        </View>

        <Pressable onPress={() => void handleLogout()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

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

      {dataError ? <Text style={styles.errorBanner}>{dataError}</Text> : null}

      {tabContent}
    </View>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    color: '#A11229',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  headerMeta: {
    color: '#5E6879',
    fontSize: 11,
  },
  headerTitle: {
    color: '#1D2637',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#EDF1F6',
    flex: 1,
    justifyContent: 'center',
  },
  logoutButton: {
    backgroundColor: '#20283A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#EEF3FF',
    fontSize: 12,
    fontWeight: '700',
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
