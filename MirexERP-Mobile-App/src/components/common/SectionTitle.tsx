import React from "react";
import { View, Text } from "react-native";
import { styles } from "./SectionTitle.styles";
export function SectionTitle({ title, action }: { title:string; action?:string }) {
 return <View style={styles.row}><Text style={styles.title}>{title}</Text>{action ? <Text style={styles.action}>{action}</Text> : null}</View>;
}
