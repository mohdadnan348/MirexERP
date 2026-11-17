import React from "react";
import { View, Text } from "react-native";
import { styles } from "./StatCard.styles";
export function StatCard({ label, value, hint }: { label:string; value:string; hint:string }) {
 return <View style={styles.card}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text><Text style={styles.hint}>{hint}</Text></View>;
}
