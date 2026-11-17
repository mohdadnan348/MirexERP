import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { feesService } from "@/services/fees.service";
import { styles } from "./FeesScreen.styles";

type InvoiceRow = Record<string, any>;
const money = (value: unknown) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export function FeesScreen() {
  const [items, setItems] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await feesService.getAll(); setItems(Array.isArray(data) ? data : []); }
    catch (cause: any) { setError(cause?.response?.data?.message || "Unable to load fee invoices."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.root}><AppHeader title="Fee Details"/><ScreenContainer>
    <View style={styles.card}><Text style={styles.heading}>Fee invoices & payment status</Text><Text style={styles.description}>Your linked student fee invoices, paid amounts and outstanding balances.</Text>
      {loading ? <ActivityIndicator style={{ margin: 24 }}/>: error ? <Text style={styles.placeholder}>{error}</Text> : items.length === 0 ? <Text style={styles.placeholder}>No fee invoices are available.</Text> : <ScrollView>{items.map((row, index) => <View key={String(row._id || index)} style={styles.record}><View style={styles.recordTop}><Text style={styles.recordTitle}>{row.invoiceNumber || "Fee invoice"}</Text><Text style={styles.status}>{String(row.status || "PENDING").replaceAll("_", " ")}</Text></View><Text style={styles.recordMeta}>Due date: {row.dueDate ? new Date(row.dueDate).toLocaleDateString("en-IN") : "—"}</Text><Text style={styles.recordMeta}>Total: {money(row.totalAmount)} · Paid: {money(row.paidAmount)}</Text><Text style={styles.balance}>Outstanding: {money(row.balanceAmount)}</Text></View>)}</ScrollView>}
      <Pressable style={styles.refresh} onPress={() => void load()}><Text style={styles.refreshText}>Refresh fee status</Text></Pressable>
    </View>
  </ScreenContainer></View>;
}
