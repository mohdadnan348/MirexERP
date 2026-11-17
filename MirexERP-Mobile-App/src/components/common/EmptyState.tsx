import React from "react";
import { View, Text } from "react-native";
import { Inbox } from "lucide-react-native";
import { styles } from "./EmptyState.styles";
export function EmptyState({ title, message }: { title:string; message:string }) {
 return <View style={styles.wrap}><Inbox color="#8B55D9" size={30}/><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text></View>;
}
