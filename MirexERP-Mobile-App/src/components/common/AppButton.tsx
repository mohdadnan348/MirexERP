import React from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";
import { styles } from "./AppButton.styles";
export function AppButton({ title, onPress, loading = false }: { title: string; onPress?: () => void; loading?: boolean }) {
  return <Pressable style={styles.button} onPress={onPress} disabled={loading}>
    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
  </Pressable>;
}
