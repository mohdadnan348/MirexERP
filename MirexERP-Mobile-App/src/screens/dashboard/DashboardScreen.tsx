import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { CalendarDays, Wallet, ClipboardList, RefreshCw, Bus, BookOpen } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { SectionTitle } from "@/components/common/SectionTitle";
import { dashboardService } from "@/services/dashboard.service";
import { styles } from "./DashboardScreen.styles";
export function DashboardScreen() {
 const { user } = useAuth(); const [data,setData]=useState<Record<string,unknown>|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 const load=async()=>{setLoading(true);setError("");try{setData(await dashboardService.getOverview());}catch{setError("Dashboard data could not be loaded. Check your connection and try again.");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const metric=(...keys:string[])=>{for(const key of keys){const value=data?.[key];if(typeof value==="number"||typeof value==="string")return String(value);}return "—";};
 const role=user?.role??"PARENT";
 return <View style={styles.root}><AppHeader title="MirexERP"/><ScreenContainer>
  <Text style={styles.greeting}>Hello, {user?.name ?? ""} 👋</Text><Text style={styles.caption}>{role==="PARENT"?"Your child's school overview.":role==="TEACHER"?"Your teaching workspace.":"Your learning overview."}</Text>
  {loading?<View style={styles.panel}><ActivityIndicator/><Text style={styles.panelText}>Loading live school data…</Text></View>:error?<Pressable style={styles.panel} onPress={()=>void load()}><Text style={styles.panelTitle}>Unable to load dashboard</Text><Text style={styles.panelText}>{error}</Text><RefreshCw color="#7138D5"/></Pressable>:<View style={styles.stats}><View style={styles.metric}><Text style={styles.metricValue}>{metric("totalStudents","studentsCount","studentCount")}</Text><Text style={styles.metricLabel}>Students</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{metric("presentToday","presentCount","todayPresent")}</Text><Text style={styles.metricLabel}>Present today</Text></View></View>}
  <SectionTitle title="Quick access"/><View style={styles.quickGrid}>
   {role==="PARENT"&&<Quick label="Fees" icon={<Wallet color="#7138D5"/>} onPress={()=>router.push("/fees")}/>}
   {(role==="PARENT"||role==="STUDENT")&&<Quick label="Transport" icon={<Bus color="#2563EB"/>} onPress={()=>router.push("/transport")}/>}
   {(role==="PARENT"||role==="STUDENT")&&<Quick label="Library" icon={<BookOpen color="#0F766E"/>} onPress={()=>router.push("/library")}/>}
   {role!=="TEACHER"&&<Quick label="Results" icon={<ClipboardList color="#315FE2"/>} onPress={()=>router.push("/results")}/>}
   <Quick label="Timetable" icon={<CalendarDays color="#C28A13"/>} onPress={()=>router.push("/timetable")}/>
   <Quick label="Academic Calendar" icon={<CalendarDays color="#7138D5"/>} onPress={()=>router.push("/calendar")}/>
   {role==="PARENT"&&<Quick label="My Children" icon={<ClipboardList color="#315FE2"/>} onPress={()=>router.push("/child-switcher")}/>}
   {role==="TEACHER"&&<Quick label="Mark Attendance" icon={<CalendarDays color="#C28A13"/>} onPress={()=>router.push("/teacher/mark-attendance")}/>}
   {role==="TEACHER"&&<Quick label="Create Homework" icon={<ClipboardList color="#315FE2"/>} onPress={()=>router.push("/teacher/create-homework")}/>}
  </View><SectionTitle title="School updates"/><View style={styles.panel}><Text style={styles.panelText}>Announcements and notifications are available in the Alerts tab.</Text></View>
 </ScreenContainer></View>;
}
function Quick({label,icon,onPress}:{label:string;icon:React.ReactNode;onPress:()=>void}){return <Pressable style={styles.quick} onPress={onPress}><View style={styles.quickIcon}>{icon}</View><Text style={styles.quickLabel}>{label}</Text></Pressable>;}
