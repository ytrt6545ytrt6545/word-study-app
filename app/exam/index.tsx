import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function ExamHome() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>考試</Text>
        <Text style={styles.subtitle}>準備檢驗你的學習成果</Text>
      </View>
      <Pressable
        style={styles.examCard}
        onPress={() => router.push('/exam/word')}
      >
        <Text style={styles.examCardIcon}>📝</Text>
        <Text style={styles.examCardTitle}>單字考試</Text>
        <Text style={styles.examCardDescription}>測試你對單字的掌握程度</Text>
        <View style={styles.examCardArrow}>
          <Text style={styles.arrowText}>→</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f5f7fa', alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
  examCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderLeftWidth: 6,
    borderLeftColor: '#4CAF50',
    minHeight: 160,
  },
  examCardIcon: { fontSize: 40, marginBottom: 12 },
  examCardTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  examCardDescription: { fontSize: 14, color: '#666', marginBottom: 16 },
  examCardArrow: { marginTop: 12, alignItems: 'flex-end' },
  arrowText: { fontSize: 24, color: '#4CAF50', fontWeight: '700' },
});
