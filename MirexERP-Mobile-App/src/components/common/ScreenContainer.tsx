import React from "react";
import { SafeAreaView, ScrollView, ViewStyle } from "react-native";
import { styles } from "./ScreenContainer.styles";
export function ScreenContainer({ children, contentStyle }: { children: React.ReactNode; contentStyle?: ViewStyle }) {
 return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={[styles.content, contentStyle]}>{children}</ScrollView></SafeAreaView>;
}
