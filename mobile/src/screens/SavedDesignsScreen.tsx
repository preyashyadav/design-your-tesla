import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SavedDesign } from '../types/design';

type SavedDesignsScreenProps = {
  onApplyDesign: (design: SavedDesign) => void;
  savedDesigns: SavedDesign[];
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
}

export function SavedDesignsScreen({ onApplyDesign, savedDesigns }: SavedDesignsScreenProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Saved Designs</Text>
      <Text style={styles.subtitle}>Locally stored presets on this device</Text>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={savedDesigns}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No designs saved yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onApplyDesign(item)} style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>{formatTimestamp(item.createdAt)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DDE6',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  cardMeta: {
    color: '#677285',
    fontSize: 12,
    marginTop: 4,
  },
  cardTitle: {
    color: '#1B2434',
    fontSize: 16,
    fontWeight: '700',
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
  screen: {
    flex: 1,
    gap: 10,
    padding: 12,
  },
  subtitle: {
    color: '#5A6372',
    fontSize: 13,
    marginBottom: 4,
  },
  title: {
    color: '#121722',
    fontSize: 26,
    fontWeight: '700',
  },
});
