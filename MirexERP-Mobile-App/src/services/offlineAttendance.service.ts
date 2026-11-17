import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY = "mirexerp_attendance_draft";
export async function saveAttendanceDraft(payload: unknown) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ payload, savedAt: new Date().toISOString() }));
}
export async function getAttendanceDraft() {
  const value = await AsyncStorage.getItem(KEY);
  return value ? JSON.parse(value) as { payload: unknown; savedAt: string } : null;
}
export async function clearAttendanceDraft() { await AsyncStorage.removeItem(KEY); }
