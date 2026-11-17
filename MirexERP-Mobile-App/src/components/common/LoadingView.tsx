import React from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { styles } from "./LoadingView.styles";
export function LoadingView() { return <View style={styles.wrap}><ActivityIndicator color="#7138D5"/><Text style={styles.text}>Loading MirexERP...</Text></View>; }
