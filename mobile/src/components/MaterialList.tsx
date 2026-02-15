import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MaterialOption } from '../types/material';

type MaterialListProps = {
  materials: MaterialOption[];
  selectedMaterialId: string | null;
  onSelect: (id: string) => void;
};

export function MaterialList({ materials, selectedMaterialId, onSelect }: MaterialListProps) {
  if (materials.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No materials found on the model.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.contentContainer}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={styles.list}
    >
      {materials.map((material) => {
        const isSelected = material.id === selectedMaterialId;
        return (
          <Pressable
            key={material.id}
            onPress={() => onSelect(material.id)}
            style={[styles.item, isSelected && styles.itemSelected]}
          >
            <Text
              style={[styles.itemText, isSelected && styles.itemTextSelected]}
              numberOfLines={1}
            >
              {material.name}
            </Text>
            {material.detail ? (
              <Text
                style={[styles.itemDetail, isSelected && styles.itemDetailSelected]}
                numberOfLines={2}
              >
                {material.detail}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    gap: 8,
    paddingBottom: 6,
  },
  emptyState: {
    borderColor: '#D8DCE3',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  emptyStateText: {
    color: '#6A727F',
    fontSize: 13,
  },
  item: {
    backgroundColor: '#F6F7F9',
    borderColor: '#D8DCE3',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemSelected: {
    backgroundColor: '#E8EDF8',
    borderColor: '#7B8DA9',
  },
  itemDetail: {
    color: '#6A727F',
    fontSize: 12,
    marginTop: 4,
  },
  itemDetailSelected: {
    color: '#4B5565',
  },
  itemText: {
    color: '#212734',
    fontSize: 14,
    fontWeight: '600',
  },
  itemTextSelected: {
    color: '#0E1A2E',
  },
  list: {
    maxHeight: 210,
  },
});
