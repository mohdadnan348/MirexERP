import React,{useState} from "react";
import {Alert,ScrollView,Text,TextInput,View} from "react-native";
import {AppHeader} from "@/components/common/AppHeader";
import {ScreenContainer} from "@/components/common/ScreenContainer";
import {AppButton} from "@/components/common/AppButton";
import {api} from "@/services/api/client";
import {styles} from "./LeaveApplicationScreen.styles";
export function LeaveApplicationScreen(){
 const [sessionId,setSessionId]=useState(""),[leaveType,setLeaveType]=useState("CASUAL"),[startDate,setStartDate]=useState(""),[endDate,setEndDate]=useState(""),[reason,setReason]=useState(""),[busy,setBusy]=useState(false);
 const submit=async()=>{if(!sessionId.trim()||!startDate||!endDate||!reason.trim()){Alert.alert("Required","Complete session, dates and reason.");return;}setBusy(true);try{await api.post("/leaves/me",{sessionId:sessionId.trim(),leaveType,startDate,endDate,reason:reason.trim()});Alert.alert("Submitted","Your leave application has been submitted for review.");setReason("");}catch(e:any){Alert.alert("Unable to submit",e?.response?.data?.message||"Please check your details.");}finally{setBusy(false);}};
 return <View style={styles.root}><AppHeader title="Apply for Leave"/><ScreenContainer><ScrollView contentContainerStyle={styles.content}><Text style={styles.label}>Academic session ID</Text><TextInput value={sessionId} onChangeText={setSessionId} style={styles.input} placeholder="Session MongoDB ID"/><Text style={styles.label}>Leave type</Text><View style={styles.row}>{["CASUAL","SICK","EARNED","UNPAID","OTHER"].map(v=><Text key={v} onPress={()=>setLeaveType(v)} style={[styles.chip,leaveType===v&&styles.active]}>{v}</Text>)}</View><Text style={styles.label}>Start date (YYYY-MM-DD)</Text><TextInput value={startDate} onChangeText={setStartDate} style={styles.input} placeholder="2026-11-20"/><Text style={styles.label}>End date (YYYY-MM-DD)</Text><TextInput value={endDate} onChangeText={setEndDate} style={styles.input} placeholder="2026-11-21"/><Text style={styles.label}>Reason</Text><TextInput value={reason} onChangeText={setReason} style={[styles.input,styles.multiline]} multiline placeholder="Reason for leave"/><AppButton title="Submit leave application" onPress={submit} loading={busy}/></ScrollView></ScreenContainer></View>;
}
