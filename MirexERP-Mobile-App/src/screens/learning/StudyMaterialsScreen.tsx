import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from "react-native";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { EmptyState } from "@/components/common/EmptyState";
import { studentPortalService } from "@/services/student-portal.service";
import { styles } from "./StudyMaterialsScreen.styles";
export function StudyMaterialsScreen() {
  const [items, setItems] = useState<any[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let active = true; (async () => { try { const data = await studentPortalService.materials(); if (active) setItems(Array.isArray(data) ? data : []); } catch (e: any) { if (active) setError(e?.response?.data?.message || "Unable to load study materials."); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, []);
  return <View style={styles.root}><AppHeader title="Study Materials" /><ScreenContainer>{loading ? <ActivityIndicator /> : error ? <Text style={styles.error}>{error}</Text> : items.length === 0 ? <EmptyState
  title="No study materials"
  message="Your teachers have not shared materials yet."
/> : <FlatList data={items} keyExtractor={item => item._id} renderItem={({ item }) => <View style={styles.card}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.subjectId?.name || "Subject"} · {item.fileName}</Text>{item.description ? <Text style={styles.description}>{item.description}</Text> : null}<Pressable onPress={() => Linking.openURL(item.fileUrl)} style={styles.button}><Text style={styles.buttonText}>Open material</Text></Pressable></View>} />}</ScreenContainer></View>;
}
