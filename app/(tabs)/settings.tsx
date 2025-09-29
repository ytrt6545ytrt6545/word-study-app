import { useEffect, useMemo, useState } from "react";
import { Button, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadSpeechSettings, listVoices, TtsVoice, loadVoiceSelection, saveVoiceForLang, saveRatePercent, getSpeechOptions, loadZhRate, saveZhRate, loadPitchPercent, savePitchPercent } from "@/utils/tts";
import * as Speech from "expo-speech";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { getSrsLimits, saveSrsLimits, getWordFontSize, saveWordFontSize } from "@/utils/storage";
import { useI18n } from "@/i18n";
import { Locale } from "@/i18n";

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const [ratePercent, setRatePercent] = useState<number>(50);
  const [pitchPercent, setPitchPercent] = useState<number>(50);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [voiceEn, setVoiceEn] = useState<string | null>(null);
  const [voiceZh, setVoiceZh] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [dailyNewLimit, setDailyNewLimit] = useState<number>(10);
  const [dailyReviewLimit, setDailyReviewLimit] = useState<number>(100);
  const [wordFontSize, setWordFontSize] = useState<number>(18);
  const [zhRate, setZhRate] = useState<number>(1.0);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSpeechSettings();
        setRatePercent(s.ratePercent);
        setPitchPercent(await loadPitchPercent());
        const vs = await listVoices();
        setVoices(vs);
        const sel = await loadVoiceSelection();
        setVoiceEn(sel.voiceEn);
        setVoiceZh(sel.voiceZh);
        const limits = await getSrsLimits();
        setDailyNewLimit(limits.dailyNewLimit);
        setDailyReviewLimit(limits.dailyReviewLimit);
        setWordFontSize(await getWordFontSize());
        setZhRate(await loadZhRate());
      } finally {
        setLoadingVoices(false);
      }
    })();
  }, []);

  const enVoices = useMemo(() => voices.filter(v => (v.language || '').toLowerCase().startsWith('en')), [voices]);
  const zhVoices = useMemo(() => voices.filter(v => (v.language || '').toLowerCase().startsWith('zh')), [voices]);
  const currentEnName = useMemo(() => {
    if (!voiceEn) return '系統預設';
    const v = enVoices.find(v => v.identifier === voiceEn);
    return (v?.name || v?.identifier || voiceEn);
  }, [voiceEn, enVoices]);
  const currentZhName = useMemo(() => {
    if (!voiceZh) return '系統預設';
    const v = zhVoices.find(v => v.identifier === voiceZh);
    return (v?.name || v?.identifier || voiceZh);
  }, [voiceZh, zhVoices]);

  const onCommitRate = async (value: number) => {
    setRatePercent(value);
    await saveRatePercent(value);
  };
  const onCommitPitch = async (value: number) => {
    const v = Math.round(value);
    setPitchPercent(v);
    await savePitchPercent(v);
  };
  const onPickVoice = async (lang: 'en' | 'zh', id: string | null) => {
    if (lang === 'en') setVoiceEn(id); else setVoiceZh(id);
    await saveVoiceForLang(lang, id);
  };
  const onCommitNewLimit = async (value: number) => {
    const v = Math.round(value);
    setDailyNewLimit(v);
    await saveSrsLimits({ dailyNewLimit: v });
  };
  const onCommitReviewLimit = async (value: number) => {
    const v = Math.round(value);
    setDailyReviewLimit(v);
    await saveSrsLimits({ dailyReviewLimit: v });
  };
  const onCommitWordFont = async (value: number) => {
    const n = Math.round(value);
    setWordFontSize(n);
    await saveWordFontSize(n);
  };
  const onSetZhRate = async (m: number) => {
    const next = await saveZhRate(m);
    setZhRate(next);
  };
  const onPreviewVoice = async (lang: 'en' | 'zh') => {
    try { Speech.stop(); } catch {}
    const text = lang === 'en' ? 'take an example' : '這是一段示例';
    const langCode = lang === 'en' ? 'en-US' : 'zh-TW';
    const opts = await getSpeechOptions(langCode);
    Speech.speak(text, { language: langCode, voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>{t('settings.title')}</Text>

        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <View style={{ marginBottom: 12 }}>
          <Picker selectedValue={locale} onValueChange={(val) => setLocale(val as Locale)}>
            <Picker.Item label={t('settings.language.zh')} value={'zh-TW'} />
            <Picker.Item label={t('settings.language.en')} value={'en'} />
          </Picker>
        </View>

        <Text style={styles.sectionTitle}>{t('settings.dailyLimit')}</Text>
        <View style={{ marginBottom: 12 }}>
          <Text>{t('settings.newLimit', { n: dailyNewLimit })}</Text>
          <Slider minimumValue={0} maximumValue={100} step={1} value={dailyNewLimit} onValueChange={setDailyNewLimit} onSlidingComplete={onCommitNewLimit} />
          <Text>{t('settings.reviewLimit', { n: dailyReviewLimit })}</Text>
          <Slider minimumValue={0} maximumValue={1000} step={10} value={dailyReviewLimit} onValueChange={setDailyReviewLimit} onSlidingComplete={onCommitReviewLimit} />
        </View>

        <Text style={styles.sectionTitle}>{t('settings.rate')}</Text>
        <View style={{ marginBottom: 4 }}>
          <Slider minimumValue={0} maximumValue={100} step={1} value={ratePercent} onValueChange={setRatePercent} onSlidingComplete={onCommitRate} />
          <Text style={styles.dim}>{t('settings.rate.hint', { n: ratePercent })}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t('settings.zhRate')}</Text>
        <View style={styles.row}>
          {[1, 1.15, 1.25, 1.35, 1.45].map((m) => (
            <View key={m} style={{ marginRight: 6 }}>
              <Button title={`${zhRate === m ? '✓ ' : ''}${m}X`} onPress={() => onSetZhRate(m)} />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('settings.pitch')}</Text>
        <View style={{ marginBottom: 8 }}>
          <Slider minimumValue={0} maximumValue={100} step={1} value={pitchPercent} onValueChange={setPitchPercent} onSlidingComplete={onCommitPitch} />
          <Text style={styles.dim}>{t('settings.pitch.hint', { n: pitchPercent })}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t('settings.wordFont')}</Text>
        <View style={{ marginBottom: 8 }}>
          <Text>{t('settings.wordFont.value', { n: wordFontSize })}</Text>
          <Slider minimumValue={12} maximumValue={48} step={1} value={wordFontSize} onValueChange={setWordFontSize} onSlidingComplete={onCommitWordFont} />
        </View>

        <Text style={styles.sectionTitle}>{t('settings.enVoices')}</Text>
        {loadingVoices ? (
          <Text style={styles.dim}>{t('settings.loadingVoices')}</Text>
        ) : (
          <View style={styles.voiceList}>
            <View style={{ flex: 1 }}>
              <Picker selectedValue={voiceEn ?? ''} onValueChange={(val) => onPickVoice('en', val === '' ? null : String(val))}>
                <Picker.Item label={t('settings.systemDefault')} value="" />
                {enVoices.map(v => (
                  <Picker.Item key={v.identifier} label={v.name || v.identifier} value={v.identifier} />
                ))}
              </Picker>
            </View>
            <View style={styles.voiceRow}>
              <Text style={styles.voiceName} numberOfLines={1}>{currentEnName}</Text>
              <Pressable onPress={() => onPreviewVoice('en')} accessibilityLabel={t('settings.previewEn')} style={{ paddingHorizontal: 6 }}>
                <MaterialIcons name="play-circle-outline" size={28} color="#1976d2" />
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('settings.zhVoices')}</Text>
        {loadingVoices ? (
          <Text style={styles.dim}>{t('settings.loadingVoices')}</Text>
        ) : (
          <View style={styles.voiceList}>
            <View style={{ flex: 1 }}>
              <Picker selectedValue={voiceZh ?? ''} onValueChange={(val) => onPickVoice('zh', val === '' ? null : String(val))}>
                <Picker.Item label={t('settings.systemDefault')} value="" />
                {zhVoices.map(v => (
                  <Picker.Item key={v.identifier} label={v.name || v.identifier} value={v.identifier} />
                ))}
              </Picker>
            </View>
            <View style={styles.voiceRow}>
              <Text style={styles.voiceName} numberOfLines={1}>{currentZhName}</Text>
              <Pressable onPress={() => onPreviewVoice('zh')} accessibilityLabel={t('settings.previewZh')} style={{ paddingHorizontal: 6 }}>
                <MaterialIcons name="play-circle-outline" size={28} color="#1976d2" />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  voiceList: { marginBottom: 8 },
  voiceRow: { flexDirection: 'row', alignItems: 'center' },
  voiceName: { maxWidth: 180, flexShrink: 1, marginRight: 6, color: '#333' },
  dim: { color: '#666' },
});
