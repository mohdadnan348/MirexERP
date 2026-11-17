import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { attendanceService } from "@/services/attendance.service";
import { styles } from "./MarkAttendanceScreen.styles";

type AttendanceRow = {
  _id: string;
  attendanceDate: string;
  attendanceType: string;
  status: string;
  periodNumber?: number | null;
  studentId?: { firstName?: string; lastName?: string; admissionNumber?: string } | string;
  employeeId?: { firstName?: string; lastName?: string; employeeId?: string } | string;
};

export function MarkAttendanceScreen() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await attendanceService.getAll({ page: 1, limit: 50 });
      setRows(Array.isArray(result?.attendance) ? result.attendance : Array.isArray(result?.items) ? result.items : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Unable to load attendance. Please check your connection and access.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const personName = (row: AttendanceRow) => {
    const person = row.studentId || row.employeeId;
    if (person && typeof person === "object") return [person.firstName, person.lastName].filter(Boolean).join(" ") || "Attendance record";
    return row.attendanceType === "STUDENT" ? "Student attendance" : "Teacher / staff attendance";
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Attendance" />
      <ScreenContainer>
        <View style={styles.card}>
          <Text style={styles.heading}>Attendance Register</Text>
          <Text style={styles.description}>Live records from your school's attendance register. Daily and timetable-period records are shown separately.</Text>
          {loading ? <ActivityIndicator /> : error ? <Text style={styles.placeholder}>{error}</Text> : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item._id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
              ListEmptyComponent={<Text style={styles.placeholder}>No attendance records found.</Text>}
              renderItem={({ item }: { item: AttendanceRow }) => (
                <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
                  <Text style={styles.heading}>{personName(item)}</Text>
                  <Text>{new Date(item.attendanceDate).toLocaleDateString()} · {item.periodNumber ? `Period ${item.periodNumber}` : "Daily"}</Text>
                  <Text>{item.status.replace(/_/g, " ")}</Text>
                </View>
              )}
            />
          )}
        </View>
      </ScreenContainer>
    </View>
  );
}
