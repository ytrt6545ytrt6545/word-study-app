import { Button, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useI18n } from "@/i18n";

export default function Index() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('index.title')}</Text>
      <Text style={styles.updated}>{t('index.lastUpdated', { date: '01/16' })}</Text>
      <Text style={styles.notice}>有更新歐</Text>
      <View style={styles.colButtons}>
        <Button title={t('index.tagsManage')} onPress={() => router.push('/tags')} />
        <View style={{ height: 10 }} />
        <Button title={t('index.review')} onPress={() => router.push('/review')} />
        <View style={{ height: 10 }} />
        <Button title={'考試'} onPress={() => router.push('/exam')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  updated: { color: '#666', marginBottom: 8 },
  notice: { color: '#2e7d32', fontWeight: 'bold', marginBottom: 8 },
  colButtons: { marginTop: 8, alignSelf: 'stretch', paddingHorizontal: 20 },
});
