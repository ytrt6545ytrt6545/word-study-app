import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import Slider from '@/components/ui/Slider';
import { useI18n } from '@/i18n';

type FontChoice = 'System' | 'serif' | 'monospace';

const COLOR_PRESETS = ['#1a73e8', '#f06292', '#2e7d32', '#ff9800', '#212121'];

function normalizeHexInput(value: string) {
  const stripped = value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
  return `#${stripped}`;
}

function resolveHex(hex: string, fallback: string) {
  if (/^#[0-9a-fA-F]{3}$/.test(hex) || /^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex;
  }
  return fallback;
}

export default function Practice() {
  const { t } = useI18n();
  const [colorInput, setColorInput] = useState('#1a73e8');
  const [shadowColorInput, setShadowColorInput] = useState('#000000');
  const [fontSize, setFontSize] = useState(28);
  const [fontFamily, setFontFamily] = useState<FontChoice>('System');
  const [spacing, setSpacing] = useState(2);
  const [shadowRadius, setShadowRadius] = useState(6);
  const [shadowOffsetX, setShadowOffsetX] = useState(0);
  const [shadowOffsetY, setShadowOffsetY] = useState(4);

  const textColor = useMemo(() => resolveHex(colorInput, '#1a73e8'), [colorInput]);
  const shadowColor = useMemo(() => resolveHex(shadowColorInput, '#000000'), [shadowColorInput]);

  const previewTextStyle = useMemo(
    () => ({
      color: textColor,
      fontSize,
      fontFamily: fontFamily === 'System' ? undefined : fontFamily,
      letterSpacing: spacing,
      lineHeight: fontSize + spacing * 2,
      textShadowColor: shadowRadius > 0 ? shadowColor : 'transparent',
      textShadowOffset: { width: shadowOffsetX, height: shadowOffsetY },
      textShadowRadius: shadowRadius,
    }),
    [textColor, fontSize, fontFamily, spacing, shadowColor, shadowRadius, shadowOffsetX, shadowOffsetY],
  );

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('practice.title')}</Text>
      <Text style={styles.note}>{t('practice.previewNote')}</Text>

      <View style={styles.previewBox}>
        <Text style={[previewTextStyle, { marginBottom: spacing * 2 }]}>這是成果</Text>
        <Text style={previewTextStyle}>這是範例</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('practice.color')}</Text>
        <TextInput
          style={styles.textInput}
          value={colorInput}
          maxLength={7}
          onChangeText={(val) => setColorInput(normalizeHexInput(val))}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
        />
        <View style={styles.swatchesRow}>
          <Text style={styles.dim}>{t('practice.quickColors')}</Text>
          <View style={styles.swatches}>
            {COLOR_PRESETS.map((item, index) => {
              const active = item.toLowerCase() === textColor.toLowerCase();
              return (
                <Pressable
                  key={item}
                  onPress={() => setColorInput(item)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: item,
                      borderColor: active ? '#000000' : '#f5f5f5',
                      marginLeft: index === 0 ? 0 : 8,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('practice.fontSize')}</Text>
        <Slider minimumValue={12} maximumValue={64} step={1} value={fontSize} onValueChange={setFontSize} />
        <Text style={styles.dim}>{fontSize.toFixed(0)} px</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('practice.fontFamily')}</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={fontFamily} onValueChange={(val) => setFontFamily(val as FontChoice)}>
            <Picker.Item label={t('practice.fontSystem')} value="System" />
            <Picker.Item label={t('practice.fontSerif')} value="serif" />
            <Picker.Item label={t('practice.fontMono')} value="monospace" />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('practice.spacing')}</Text>
        <Slider minimumValue={0} maximumValue={16} step={0.5} value={spacing} onValueChange={setSpacing} />
        <Text style={styles.dim}>{spacing.toFixed(1)} px</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('practice.shadow')}</Text>
        <Text style={styles.subLabel}>{t('practice.shadowColor')}</Text>
        <TextInput
          style={styles.textInput}
          value={shadowColorInput}
          maxLength={7}
          onChangeText={(val) => setShadowColorInput(normalizeHexInput(val))}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
        />
        <Text style={styles.subLabel}>{t('practice.offsetX')}</Text>
        <Slider
          minimumValue={-20}
          maximumValue={20}
          step={1}
          value={shadowOffsetX}
          onValueChange={setShadowOffsetX}
        />
        <Text style={styles.dim}>{shadowOffsetX.toFixed(0)} px</Text>
        <Text style={styles.subLabel}>{t('practice.offsetY')}</Text>
        <Slider
          minimumValue={-20}
          maximumValue={20}
          step={1}
          value={shadowOffsetY}
          onValueChange={setShadowOffsetY}
        />
        <Text style={styles.dim}>{shadowOffsetY.toFixed(0)} px</Text>
        <Text style={styles.subLabel}>{t('practice.radius')}</Text>
        <Slider minimumValue={0} maximumValue={20} step={0.5} value={shadowRadius} onValueChange={setShadowRadius} />
        <Text style={styles.dim}>{shadowRadius.toFixed(1)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  note: {
    color: '#666666',
    marginTop: 4,
    marginBottom: 16,
  },
  previewBox: {
    marginTop: 12,
    marginBottom: 8,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  dim: {
    color: '#666666',
    marginTop: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  swatches: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
