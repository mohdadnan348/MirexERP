import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { resultsService } from "@/services/results.service";
import { styles } from "./ResultsScreen.styles";

type ResultRow = Record<string, any>;
const label = (value: any) => typeof value === "string" ? value : value?.name || value?.subjectName || value?.examName || "—";
export function ResultsScreen() {
  const [items, setItems] = useState<ResultRow[]>([]);
  const [exams, setExams] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [data, schedule] = await Promise.all([resultsService.getAll(), resultsService.getSchedule()]); setItems(Array.isArray(data) ? data : []); setExams(Array.isArray(schedule) ? schedule : []); }
    catch (cause: any) { setError(cause?.response?.data?.message || "Unable to load published results."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.root}><AppHeader title="Examination Results"/><ScreenContainer>
    <View style={styles.card}><Text style={styles.heading}>Published examination results</Text><Text style={styles.description}>Upcoming examination schedules and approved, published marks for your linked student account.</Text>
      <Text style={styles.sectionHeading}>Examination schedule</Text>
      {exams.length === 0 ? <Text style={styles.recordMeta}>No scheduled examinations.</Text> : exams.map((exam, index) => <View key={String(exam._id || index)} style={styles.record}><Text style={styles.recordTitle}>{exam.examName}</Text><Text style={styles.recordMeta}>{exam.examType} · {exam.status}</Text><Text style={styles.recordMeta}>{new Date(exam.startDate).toLocaleDateString("en-IN")} – {new Date(exam.endDate).toLocaleDateString("en-IN")}</Text></View>)}
      <Text style={styles.sectionHeading}>Published results</Text>
      {loading ? <ActivityIndicator style={{ margin: 24 }}/>: error ? <Text style={styles.placeholder}>{error}</Text> : items.length === 0 ? <Text style={styles.placeholder}>No published results are available yet.</Text> : <ScrollView>{items.map((row, index) => <View key={String(row._id || index)} style={styles.record}><View style={styles.recordTop}><Text style={styles.recordTitle}>{label(row.examId)}</Text><Text style={styles.recordValue}>{row.isAbsent ? "Absent" : `${row.marksObtained ?? 0} marks`}</Text></View><Text style={styles.recordMeta}>Subject: {label(row.subjectId)}</Text>{row.remarks ? <Text style={styles.recordMeta}>Remarks: {row.remarks}</Text> : null}</View>)}</ScrollView>}
      <Pressable style={styles.refresh} onPress={() => void load()}><Text style={styles.refreshText}>Refresh results</Text></Pressable>
    </View>
  </ScreenContainer></View>;
}
