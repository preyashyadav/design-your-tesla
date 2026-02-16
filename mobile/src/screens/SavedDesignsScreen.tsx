import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DesignStatus, SavedDesign } from '../types/design';

type SavedDesignsScreenProps = {
  onApplyDesign: (design: SavedDesign) => void;
  onSubmitDesign: (design: SavedDesign) => Promise<void>;
  savedDesigns: SavedDesign[];
  submittingDesignId: string | null;
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
}

function badgeStyles(status: DesignStatus): {
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

export function SavedDesignsScreen({
  onApplyDesign,
  onSubmitDesign,
  savedDesigns,
  submittingDesignId,
}: SavedDesignsScreenProps) {
  const [selectedDesignID, setSelectedDesignID] = useState<string | null>(savedDesigns[0]?.id ?? null);

  useEffect(() => {
    if (!selectedDesignID) {
      setSelectedDesignID(savedDesigns[0]?.id ?? null);
      return;
    }
    if (!savedDesigns.some((item) => item.id === selectedDesignID)) {
      setSelectedDesignID(savedDesigns[0]?.id ?? null);
    }
  }, [savedDesigns, selectedDesignID]);

  const selectedDesign = useMemo(
    () => savedDesigns.find((item) => item.id === selectedDesignID) ?? null,
    [savedDesigns, selectedDesignID],
  );

  const canSubmitSelected =
    selectedDesign && (selectedDesign.status === 'DRAFT' || selectedDesign.status === 'REJECTED');

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Saved Designs</Text>
      <Text style={styles.subtitle}>Synced designs for your account</Text>

      {selectedDesign ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>{selectedDesign.name}</Text>
            <View style={[styles.statusBadge, badgeStyles(selectedDesign.status).container]}>
              <Text style={[styles.statusText, badgeStyles(selectedDesign.status).text]}>
                {selectedDesign.status}
              </Text>
            </View>
          </View>

          <Text style={styles.cardMeta}>Created {formatTimestamp(selectedDesign.createdAt)}</Text>
          {selectedDesign.status === 'REJECTED' && selectedDesign.rejectionReason ? (
            <Text style={styles.rejectionText}>Reason: {selectedDesign.rejectionReason}</Text>
          ) : null}

          <View style={styles.summaryActions}>
            <Pressable onPress={() => onApplyDesign(selectedDesign)} style={styles.actionButton}>
              <Text style={styles.actionText}>Load in Configurator</Text>
            </Pressable>

            <Pressable
              disabled={!canSubmitSelected || submittingDesignId === selectedDesign.id}
              onPress={() => {
                if (!canSubmitSelected) {
                  return;
                }
                void onSubmitDesign(selectedDesign);
              }}
              style={[
                styles.actionButton,
                styles.submitButton,
                (!canSubmitSelected || submittingDesignId === selectedDesign.id) && styles.disabled,
              ]}
            >
              <Text style={styles.actionText}>
                {submittingDesignId === selectedDesign.id ? 'Submitting...' : 'Submit for Approval'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No designs saved yet.</Text>
        </View>
      )}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={savedDesigns}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const selected = item.id === selectedDesignID;
          return (
            <Pressable
              onPress={() => {
                setSelectedDesignID(item.id);
              }}
              style={[styles.card, selected && styles.cardSelected]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={[styles.statusBadge, badgeStyles(item.status).container]}>
                  <Text style={[styles.statusText, badgeStyles(item.status).text]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>{formatTimestamp(item.createdAt)}</Text>
              {item.status === 'REJECTED' && item.rejectionReason ? (
                <Text style={styles.rejectionText}>Reason: {item.rejectionReason}</Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#20283A',
    borderRadius: 10,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  actionText: {
    color: '#F3F7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DDE6',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMeta: {
    color: '#677285',
    fontSize: 12,
    marginTop: 4,
  },
  cardSelected: {
    borderColor: '#95A7C8',
  },
  cardTitle: {
    color: '#1B2434',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DDE6',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    padding: 20,
  },
  emptyText: {
    color: '#677285',
    fontSize: 13,
  },
  listContent: {
    gap: 10,
    paddingBottom: 30,
  },
  rejectionText: {
    color: '#A11229',
    fontSize: 12,
    marginTop: 6,
  },
  screen: {
    flex: 1,
    gap: 10,
    padding: 12,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#5A6372',
    fontSize: 13,
    marginBottom: 2,
  },
  submitButton: {
    backgroundColor: '#111317',
  },
  summaryActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DDE6',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  summaryTitle: {
    color: '#162032',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  title: {
    color: '#121722',
    fontSize: 26,
    fontWeight: '700',
  },
});
