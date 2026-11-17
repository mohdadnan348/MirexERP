import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { homeworkService } from "@/services/homework.service";
import { useAuth } from "@/context/AuthContext";
import { styles } from "./HomeworkScreen.styles";

type HomeworkRow = Record<string, any>;
const idOf = (value: any) => String(value?._id || value?.id || value || "");
const dueText = (value: any) => value ? new Date(value).toLocaleDateString("en-IN") : "—";

export function HomeworkScreen() {
  const { user } = useAuth();
  const isParent = user?.role === "PARENT";
  const isTeacher = user?.role === "TEACHER";
  const [items, setItems] = useState<HomeworkRow[]>([]);
  const [linkedChildren, setLinkedChildren] = useState<HomeworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<HomeworkRow | null>(null);
  const [answer, setAnswer] = useState("");
  const [childId, setChildId] = useState("");
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [submissions, setSubmissions] = useState<HomeworkRow[]>([]);
  const [pending, setPending] = useState<HomeworkRow[]>([]);
  const [reviewTarget, setReviewTarget] = useState<HomeworkRow | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [requestResubmission, setRequestResubmission] = useState(false);
  const [reviewHistory, setReviewHistory] = useState<HomeworkRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await homeworkService.getAll({ page: 1, limit: 100 });
      setItems(Array.isArray(result) ? result : []);
    } catch (e: any) { setError(e?.response?.data?.message || "Unable to load homework."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (isParent) {
      homeworkService.getLinkedChildren().then((rows) => setLinkedChildren(Array.isArray(rows) ? rows : []))
        .catch((e: any) => setError(e?.response?.data?.message || "Unable to load linked children."));
    }
    if (user?.role === "PARENT" || user?.role === "STUDENT") {
      homeworkService.getNotificationPreferences(user.role).then((preferences) => {
        setNotificationsEnabled(user.role === "PARENT" ? preferences?.homework !== false : preferences?.notificationsEnabled !== false);
      }).catch(() => undefined);
    }
  }, [isParent, user?.role]);

  const children = useMemo(() => linkedChildren.map((child) => ({
    id: idOf(child), name: `${child.firstName || ""} ${child.lastName || ""}`.trim() || "Linked child",
  })), [linkedChildren]);

  const toggleNotifications = async (enabled: boolean) => {
    if (!user?.role) return;
    setNotificationsEnabled(enabled);
    try {
      await homeworkService.updateNotificationPreferences(user.role, enabled);
    } catch (e: any) {
      setNotificationsEnabled(!enabled);
      Alert.alert("Preference not saved", e?.response?.data?.message || "Please try again.");
    }
  };

  const open = async (item: HomeworkRow) => {
    try {
      if (isParent && !childId) { Alert.alert("Select child", "Choose the linked child before opening homework details."); return; }
      const detail = await homeworkService.getById(idOf(item), isParent ? { studentId: childId } : undefined);
      setSelected(detail); setAnswer(""); setFile(null);
      if (isTeacher) {
        const [submissionRows, pendingResult] = await Promise.all([
          homeworkService.getSubmissions(idOf(item)),
          homeworkService.getPending(idOf(item)),
        ]);
        setSubmissions(Array.isArray(submissionRows) ? submissionRows : []);
        setPending(pendingResult?.items || []);
      }
    } catch (e: any) { Alert.alert("Unable to open homework", e?.response?.data?.message || "Please try again."); }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) { Alert.alert("File too large", "Each attachment must be 10 MB or smaller."); return; }
      setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined });
    }
  };

  const saveEvaluation = async () => {
    if (!selected || !reviewTarget) return;
    setSaving(true);
    try {
      await homeworkService.evaluate(idOf(selected), idOf(reviewTarget), {
        marksObtained: marks.trim() ? Number(marks) : undefined,
        feedback,
        requestResubmission,
      });
      Alert.alert("Saved", requestResubmission ? "Resubmission requested." : "Evaluation saved.");
      setReviewTarget(null);
      const updated = await homeworkService.getSubmissions(idOf(selected));
      setSubmissions(Array.isArray(updated) ? updated : []);
    } catch (e: any) {
      Alert.alert("Evaluation failed", e?.response?.data?.message || "Please try again.");
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!selected) return;
    if (!answer.trim() && !file) { Alert.alert("Answer required", "Write an answer or attach a file."); return; }
    if (isParent && !childId) { Alert.alert("Select child", "Choose the child for this submission."); return; }
    setSaving(true);
    try {
      await homeworkService.submit(idOf(selected), answer, isParent ? childId : undefined, file || undefined);
      Alert.alert("Submitted", "Your homework has been submitted successfully.");
      setSelected(null); await load();
    } catch (e: any) {
      Alert.alert("Submission failed", e?.response?.data?.message || "Please try again.");
    } finally { setSaving(false); }
  };

  return <View style={styles.root}>
    <AppHeader title="Homework" />
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.heading}>Homework & Assignments</Text>
          <Text style={styles.description}>Assignments, due dates, submissions and teacher feedback.</Text>
          {(isParent || user?.role === "STUDENT") && <View style={styles.preferenceRow}><Text style={styles.itemMeta}>Homework notifications</Text><Switch value={notificationsEnabled} onValueChange={(value) => void toggleNotifications(value)} /></View>}
          {isParent && children.length > 0 && <>
            <Text style={styles.fieldLabel}>Select child</Text>
            <View style={styles.childList}>{children.map((child) => <Pressable key={child.id} onPress={() => setChildId(child.id)} style={[styles.childButton, childId === child.id && styles.childSelected]}><Text style={[styles.childText, childId === child.id && styles.childTextSelected]}>{child.name}</Text></Pressable>)}</View>
          </>}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : items.length === 0 ? <Text style={styles.empty}>No homework has been assigned yet.</Text> :
          items.map((item) => {
            const childSubmission = (item.childSubmissions || []).find((entry: any) => idOf(entry.studentId) === childId)?.submission;
            const submission = item.mySubmission || childSubmission;
            const status = submission?.status || (new Date(item.dueDate) < new Date() ? "OVERDUE" : "PENDING");
            return <Pressable key={idOf(item)} style={styles.itemCard} onPress={() => void open(item)}>
              <View style={styles.itemTop}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.status}>{status}</Text></View>
              <Text style={styles.itemMeta}>{item.subjectId?.name || "Subject"} · {item.classId?.name || "Class"}</Text>
              <Text style={styles.itemMeta}>Due: {dueText(item.dueDate)}</Text>
              {submission?.marksObtained !== undefined && <Text style={styles.feedback}>Marks: {submission.marksObtained} / {item.totalMarks ?? "—"} · {submission.feedback || "Evaluated"}</Text>}
              <Text style={styles.openText}>Open details →</Text>
            </Pressable>;
          })}
        <Pressable style={styles.refreshButton} onPress={() => void load()}><Text style={styles.refreshText}>Refresh homework</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
    {selected && <View style={styles.modalBackdrop}><View style={styles.modal}>
      <ScrollView>
        <Text style={styles.heading}>{selected.title}</Text>
        <Text style={styles.description}>{selected.description}</Text>
        {selected.instructions ? <Text style={styles.description}>{selected.instructions}</Text> : null}
        <Text style={styles.itemMeta}>Due date: {dueText(selected.dueDate)}</Text>
        {(selected.attachments || []).map((attachment: any, index: number) => <Pressable key={attachment._id || index} onPress={() => homeworkService.downloadAttachment(attachment.url, attachment.name).catch((e: any) => Alert.alert("Download failed", e?.message || "Please try again."))}><Text style={styles.attachment}>Download: {attachment.name}</Text></Pressable>)}
        {selected.mySubmission?.status ? <Text style={styles.feedback}>Status: {selected.mySubmission.status} · Attempt {selected.mySubmission.attemptNumber || 1} · Submitted {dueText(selected.mySubmission.submittedAt)}</Text> : null}
        {selected.mySubmission?.marksObtained !== undefined ? <Text style={styles.feedback}>Marks: {selected.mySubmission.marksObtained} / {selected.totalMarks ?? "—"}{"\n"}{selected.mySubmission.feedback}</Text> : null}
        {isTeacher ? <>
          <Text style={styles.fieldLabel}>Student submissions</Text>
          {submissions.map((row) => <View key={idOf(row)} style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>{row.studentId?.firstName} {row.studentId?.lastName} · {row.studentId?.admissionNumber}</Text>
            <Text style={styles.itemMeta}>Status: {row.status} · Attempt {row.attemptNumber || 1} · Submitted: {dueText(row.submittedAt)}</Text>
            <Text style={styles.description}>{row.answer || "File submission"}</Text>
            <Pressable style={styles.fileButton} onPress={() => {
              setReviewTarget(row); setMarks(row.marksObtained == null ? "" : String(row.marksObtained));
              setFeedback(row.feedback || ""); setRequestResubmission(false); setReviewHistory([]);
              homeworkService.getSubmissionHistory(idOf(row)).then((history) => setReviewHistory(history?.evaluationHistory || []))
                .catch(() => setReviewHistory([]));
            }}><Text style={styles.fileButtonText}>Evaluate submission</Text></Pressable>
          </View>)}
          <Text style={styles.fieldLabel}>Pending students: {pending.length}</Text>
          {pending.slice(0, 30).map((row) => <Text key={idOf(row.studentId)} style={styles.itemMeta}>{row.studentName} · {row.admissionNumber} · {row.status}</Text>)}
          {reviewTarget && <View style={styles.reviewForm}>
            <Text style={styles.reviewTitle}>Evaluation</Text>
            {reviewHistory.map((entry, index) => <Text key={entry._id || index} style={styles.itemMeta}>{entry.action} · {dueText(entry.evaluatedAt)} · {entry.marksObtained ?? "No marks"} · {entry.feedback || "No feedback"}</Text>)}
            <TextInput value={marks} onChangeText={setMarks} keyboardType="decimal-pad" placeholder={`Marks (max ${selected.totalMarks ?? "not set"})`} style={styles.answerInput} />
            <TextInput value={feedback} onChangeText={setFeedback} placeholder="Teacher feedback" multiline style={styles.answerInput} />
            <View style={styles.switchRow}><Text style={styles.itemMeta}>Request resubmission</Text><Pressable onPress={() => setRequestResubmission((v) => !v)}><Text style={styles.fileButtonText}>{requestResubmission ? "ON" : "OFF"}</Text></Pressable></View>
            <Pressable style={styles.submitButton} onPress={() => void saveEvaluation()} disabled={saving}><Text style={styles.submitText}>{saving ? "Saving..." : "Save evaluation"}</Text></Pressable>
          </View>}
        </> : selected.allowSubmission !== false ? <><Text style={styles.fieldLabel}>Your answer</Text><TextInput multiline value={answer} onChangeText={setAnswer} placeholder="Write your answer..." style={styles.answerInput} textAlignVertical="top" /><Pressable style={styles.fileButton} onPress={() => void pickFile()}><Text style={styles.fileButtonText}>{file ? file.name : "Choose attachment (max 10 MB)"}</Text></Pressable><Pressable style={styles.submitButton} onPress={() => void submit()} disabled={saving}><Text style={styles.submitText}>{saving ? "Submitting..." : "Submit homework"}</Text></Pressable></> : null}
        <Pressable style={styles.closeButton} onPress={() => setSelected(null)}><Text style={styles.closeText}>Close</Text></Pressable>
      </ScrollView>
    </View></View>}
  </View>;
}
