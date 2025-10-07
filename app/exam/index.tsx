import { Button, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function ExamHome() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>考試</Text>
      <View style={{ height: 12 }} />
      <Button title="單字考試" onPress={() => router.push('/exam/word')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});

