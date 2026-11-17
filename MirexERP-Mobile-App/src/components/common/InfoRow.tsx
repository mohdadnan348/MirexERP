import React from "react";
import { View, Text } from "react-native";
import { styles } from "./InfoRow.styles";
export function InfoRow({ label, value }: { label:string; value:string }) {
 return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}
