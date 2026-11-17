import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { homeworkService } from "@/services/homework.service";
import { useAuth } from "@/context/AuthContext";
import { styles } from "./CreateHomeworkScreen.styles";

export function CreateHomeworkScreen() {
  const { user } = useAuth();
  const [values, setValues] = useState({
    academicSessionId: "", classId: "", sectionId: "", subjectId: "", teacherId: "",
    title: "", description: "", instructions: "", dueDate: "", totalMarks: "",
  });
  const [allowSubmission, setAllowSubmission] = useState(true);
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [publish, setPublish] = useState(false);
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const update = (key: string, value: string) => setValues((old) => ({ ...old, [key]: value }));

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) { Alert.alert("File too large", "Each file must be 10 MB or smaller."); return; }
      setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined });
    }
  };
  const save = async () => {
    if (!values.academicSessionId || !values.classId || !values.subjectId || !values.title.trim() || !values.description.trim() || !values.dueDate) {
      Alert.alert("Required fields", "Enter academic session, class, subject, title, description and due date."); return;
    }
    if (user?.role !== "TEACHER" && !values.teacherId) { Alert.alert("Teacher required", "Enter the assigned teacher employee ID."); return; }
    setSaving(true);
    try {
      await homeworkService.create({
        ...values,
        sectionIds: values.sectionId ? [values.sectionId] : [],
        totalMarks: values.totalMarks ? Number(values.totalMarks) : undefined,
        teacherId: user?.role === "TEACHER" ? undefined : values.teacherId,
        allowSubmission, allowLateSubmission, allowResubmission,
        status: publish ? "PUBLISHED" : "DRAFT",
      }, file || undefined);
      Alert.alert("Saved", publish ? "Homework published successfully." : "Homework saved as draft.");
      setValues({ academicSessionId: "", classId: "", sectionId: "", subjectId: "", teacherId: "", title: "", description: "", instructions: "", dueDate: "", totalMarks: "" });
      setFile(null); setPublish(false);
    } catch (e: any) { Alert.alert("Unable to save homework", e?.response?.data?.message || "Please verify the entered IDs and try again."); }
    finally { setSaving(false); }
  };

  const field = (key: string, placeholder: string, multiline = false, keyboardType: any = "default") =>
    <TextInput key={key} value={(values as Record<string, string>)[key] || ""} onChangeText={(value) => update(key, value)} placeholder={placeholder} keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} style={[styles.input, multiline && styles.multiline]} />;

  return <View style={styles.root}>
    <AppHeader title="Create Homework" />
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.heading}>Create Homework</Text>
          <Text style={styles.description}>Create an assignment for your class. IDs are validated against your school's active academic setup.</Text>
          {field("academicSessionId", "Academic session ID")}
          {field("classId", "Class ID")}
          {field("sectionId", "Section ID (optional; leave blank for whole class)")}
          {field("subjectId", "Subject ID")}
          {user?.role !== "TEACHER" ? field("teacherId", "Assigned teacher employee ID") : null}
          {field("title", "Homework title")}
          {field("description", "Description / instructions", true)}
          {field("instructions", "Additional instructions (optional)", true)}
          {field("dueDate", "Due date (YYYY-MM-DD)")}
          {field("totalMarks", "Maximum marks (optional)", false, "numeric")}
          <View style={styles.switchRow}><Text style={styles.switchLabel}>Allow submissions</Text><Switch value={allowSubmission} onValueChange={setAllowSubmission} /></View>
          <View style={styles.switchRow}><Text style={styles.switchLabel}>Allow late submissions</Text><Switch value={allowLateSubmission} onValueChange={setAllowLateSubmission} /></View>
          <View style={styles.switchRow}><Text style={styles.switchLabel}>Allow resubmission after teacher request</Text><Switch value={allowResubmission} onValueChange={setAllowResubmission} /></View>
          <View style={styles.switchRow}><Text style={styles.switchLabel}>Publish immediately</Text><Switch value={publish} onValueChange={setPublish} /></View>
          <Pressable style={styles.fileButton} onPress={() => void pickFile()}><Text style={styles.fileText}>{file ? file.name : "Add attachment (max 10 MB)"}</Text></Pressable>
          <Pressable style={styles.submitButton} onPress={() => void save()} disabled={saving}><Text style={styles.submitText}>{saving ? "Saving..." : publish ? "Publish homework" : "Save draft"}</Text></Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  </View>;
}
