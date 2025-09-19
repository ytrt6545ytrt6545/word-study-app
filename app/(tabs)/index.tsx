import { Button, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>首頁</Text>
      <Text style={styles.updated}>本次修改：9/16</Text>
      <View style={styles.colButtons}>
        <Button title="標籤管理" onPress={() => router.push('/tags')} />
        <View style={{ height: 10 }} />
        <Button title="複習" onPress={() => router.push('/review')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  updated: { color: '#666', marginBottom: 8 },
  colButtons: { marginTop: 8, alignSelf: 'stretch', paddingHorizontal: 20 },
});

