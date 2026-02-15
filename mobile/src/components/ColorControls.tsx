import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LookMode } from '../config/designer';

type WheelPickerProps = {
  color: string;
  onColorChangeComplete?: (color: string) => void;
  thumbSize?: number;
  row?: boolean;
  sliderSize?: number;
  swatches?: boolean;
};

const WheelColorPicker = (() => {
  try {
    const mod = require('react-native-wheel-color-picker') as unknown as
      | ComponentType<WheelPickerProps>
      | { default?: ComponentType<WheelPickerProps> };

    if (typeof mod === 'function') {
      return mod;
    }
    if (mod && typeof mod === 'object' && mod.default && typeof mod.default === 'function') {
      return mod.default;
    }
  } catch {
    // try alternate package name below
  }

  try {
    const mod = require('react-native-color-wheel-picker') as unknown as
      | ComponentType<WheelPickerProps>
      | { default?: ComponentType<WheelPickerProps> };

    if (typeof mod === 'function') {
      return mod;
    }
    if (mod && typeof mod === 'object' && mod.default && typeof mod.default === 'function') {
      return mod.default;
    }

    return null;
  } catch {
    return null;
  }
})();

const MODES: Array<{ id: LookMode; label: string }> = [
  { id: 'cyber', label: 'Cyber' },
  { id: 'stealth', label: 'Stealth' },
  { id: 'custom', label: 'Custom' },
];

type ColorControlsProps = {
  hexInput: string;
  isCustomMode: boolean;
  mode: LookMode;
  onHexInputChange: (value: string) => void;
  onModeChange: (mode: LookMode) => void;
  onPaletteSelect: (hex: string) => void;
  onWheelColorChange: (hex: string) => void;
  palette: string[];
  selectedMaterialName: string | null;
};

export function ColorControls({
  hexInput,
  isCustomMode,
  mode,
  onHexInputChange,
  onModeChange,
  onPaletteSelect,
  onWheelColorChange,
  palette,
  selectedMaterialName,
}: ColorControlsProps) {
  const [wheelVisible, setWheelVisible] = useState(false);

  useEffect(() => {
    if (!isCustomMode) {
      setWheelVisible(false);
    }
  }, [isCustomMode]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Looks</Text>
      <View style={styles.modeRow}>
        {MODES.map((preset) => {
          const active = preset.id === mode;
          return (
            <Pressable
              key={preset.id}
              onPress={() => onModeChange(preset.id)}
              style={[styles.modeButton, active && styles.modeButtonActive]}
            >
              <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!isCustomMode ? (
        <Text style={styles.presetHint}>
          Preset applied to all mapped materials. Switch to Custom for manual tuning.
        </Text>
      ) : null}

      {isCustomMode ? (
        <>
          <Text style={styles.label}>Selected Material</Text>
          <Text style={styles.materialName}>{selectedMaterialName ?? 'None'}</Text>

          <View style={styles.paletteHeaderRow}>
            <Text style={styles.label}>Suggested Palette</Text>
            <Pressable
              onPress={() => setWheelVisible((current) => !current)}
              style={styles.chooseColorButton}
            >
              <Text style={styles.chooseColorText}>
                {wheelVisible ? 'Hide Color' : 'Choose Color'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.paletteRow}>
            {palette.map((color) => (
              <Pressable
                key={color}
                onPress={() => onPaletteSelect(color)}
                style={[styles.swatch, { backgroundColor: color }]}
              />
            ))}
          </View>

          <Text style={styles.label}>Hex Color</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={onHexInputChange}
            placeholder="#RRGGBB"
            placeholderTextColor="#7E8597"
            style={styles.input}
            value={hexInput}
          />

          {wheelVisible ? (
            <>
              <Text style={styles.label}>Color Wheel</Text>
              {WheelColorPicker ? (
                <View style={styles.wheelContainer}>
                  <WheelColorPicker
                    color={hexInput}
                    onColorChangeComplete={onWheelColorChange}
                    row={false}
                    sliderSize={22}
                    swatches={false}
                    thumbSize={24}
                  />
                </View>
              ) : (
                <Text style={styles.wheelHint}>
                  Install `react-native-wheel-color-picker` to enable wheel-based color picking.
                </Text>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chooseColorButton: {
    backgroundColor: '#111317',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chooseColorText: {
    color: '#F5F7FB',
    fontSize: 12,
    fontWeight: '600',
  },
  container: {
    gap: 8,
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
  label: {
    color: '#6A727F',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  materialName: {
    color: '#1E2532',
    fontSize: 15,
    fontWeight: '600',
  },
  modeButton: {
    backgroundColor: '#F2F4F7',
    borderColor: '#D8DCE3',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: '#111317',
    borderColor: '#111317',
  },
  modeLabel: {
    color: '#4C5669',
    fontSize: 13,
    fontWeight: '600',
  },
  modeLabelActive: {
    color: '#F5F7FB',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paletteHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetHint: {
    color: '#556070',
    fontSize: 13,
    lineHeight: 18,
  },
  swatch: {
    borderColor: '#C9CFDA',
    borderRadius: 14,
    borderWidth: 1,
    height: 30,
    width: 30,
  },
  wheelContainer: {
    backgroundColor: '#F7F8FA',
    borderColor: '#D8DCE3',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 240,
    padding: 8,
  },
  wheelHint: {
    color: '#556070',
    fontSize: 12,
  },
});
