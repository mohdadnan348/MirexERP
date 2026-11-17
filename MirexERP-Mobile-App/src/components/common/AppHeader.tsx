import React from "react";
import { View, Text, Pressable } from "react-native";
import { Bell, Menu } from "lucide-react-native";
import { styles } from "./AppHeader.styles";
export function AppHeader({ title, onMenu }: { title: string; onMenu?: () => void }) {
 return <View style={styles.container}><Pressable onPress={onMenu}><Menu color="#fff" size={22}/></Pressable><Text style={styles.title}>{title}</Text><Bell color="#fff" size={21}/></View>;
}
