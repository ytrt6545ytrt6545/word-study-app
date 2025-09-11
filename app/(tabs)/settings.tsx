import { useEffect, useMemo, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadSpeechSettings, saveGender, listVoices, TtsVoice, VoiceGender, loadVoiceSelection, saveVoiceForLang, saveRatePercent } from "../../utils/tts";
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { getSrsLimits, saveSrsLimits } from "@/utils/storage";

export default function Settings() {
  const [ratePercent, setRatePercent] = useState<number>(50);
  const [gender, setGender] = useState<VoiceGender>("female");
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [voiceEn, setVoiceEn] = useState<string | null>(null);
  const [voiceZh, setVoiceZh] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [dailyNewLimit, setDailyNewLimit] = useState<number>(10);
  const [dailyReviewLimit, setDailyReviewLimit] = useState<number>(100);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSpeechSettings();
        setRatePercent(s.ratePercent);
        setGender(s.gender);
        const vs = await listVoices();
        setVoices(vs);
        const sel = await loadVoiceSelection();
        setVoiceEn(sel.voiceEn);
        setVoiceZh(sel.voiceZh);
        const limits = await getSrsLimits();
        setDailyNewLimit(limits.dailyNewLimit);
        setDailyReviewLimit(limits.dailyReviewLimit);
      } catch {}
      finally { setLoadingVoices(false); }
    })();
  }, []);

  const enVoices = useMemo(() => voices.filter(v => (v.language || '').toLowerCase().startsWith('en')), [voices]);
  const zhVoices = useMemo(() => voices.filter(v => (v.language || '').toLowerCase().startsWith('zh')), [voices]);

  const onCommitRate = async (value: number) => {
    setRatePercent(value);
    await saveRatePercent(value);
  };

  const onSetGender = async (g: VoiceGender) => {
    setGender(g);
    await saveGender(g);
    Alert.alert("已更新", "語音音色已更新");
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>設定</Text>

        <Text style={styles.sectionTitle}>複習每日上限</Text>
        <View style={{ marginBottom: 12 }}>
          <Text>{`新卡上限：${dailyNewLimit}`}</Text>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={dailyNewLimit}
            onValueChange={setDailyNewLimit}
            onSlidingComplete={onCommitNewLimit}
          />
          <Text>{`複習上限：${dailyReviewLimit}`}</Text>
          <Slider
            minimumValue={0}
            maximumValue={1000}
            step={10}
            value={dailyReviewLimit}
            onValueChange={setDailyReviewLimit}
            onSlidingComplete={onCommitReviewLimit}
          />
        </View>

        <Text style={styles.sectionTitle}>語速（英文）</Text>
        <View style={{ marginBottom: 4 }}>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={ratePercent}
            onValueChange={setRatePercent}
            onSlidingComplete={onCommitRate}
          />
          <Text style={styles.dim}>{`目前：${ratePercent}/100（中文固定正常速度）`}</Text>
        </View>

        <Text style={styles.sectionTitle}>語音（男／女）</Text>
        <View style={styles.row}>
          <Button title={`${gender === 'male' ? '● ' : ''}男聲`} onPress={() => onSetGender('male')} />
          <Button title={`${gender === 'female' ? '● ' : ''}女聲`} onPress={() => onSetGender('female')} />
        </View>

        <Text style={styles.sectionTitle}>英文語音清單</Text>
        {loadingVoices ? (
          <Text style={styles.dim}>載入可用語音中…</Text>
        ) : (
          <View style={styles.voiceList}>
            <Picker
              selectedValue={voiceEn ?? ''}
              onValueChange={(val) => onPickVoice('en', val === '' ? null : String(val))}
            >
              <Picker.Item label="系統預設" value="" />
              {enVoices.map(v => (
                <Picker.Item key={v.identifier} label={v.name || v.identifier} value={v.identifier} />
              ))}
            </Picker>
            {enVoices.length === 0 && <Text style={styles.dim}>找不到英語語音</Text>}
          </View>
        )}

        <Text style={styles.sectionTitle}>中文語音清單</Text>
        {loadingVoices ? (
          <Text style={styles.dim}>載入可用語音中…</Text>
        ) : (
          <View style={styles.voiceList}>
            <Picker
              selectedValue={voiceZh ?? ''}
              onValueChange={(val) => onPickVoice('zh', val === '' ? null : String(val))}
            >
              <Picker.Item label="系統預設" value="" />
              {zhVoices.map(v => (
                <Picker.Item key={v.identifier} label={v.name || v.identifier} value={v.identifier} />
              ))}
            </Picker>
            {zhVoices.length === 0 && <Text style={styles.dim}>找不到中文語音</Text>}
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
  voiceList: { marginBottom: 4 },
  dim: { color: '#666' },
});

