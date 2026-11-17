import React,{useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "expo-router";
import {View,Text,ScrollView,ActivityIndicator,Pressable} from "react-native";
import {AppHeader} from "@/components/common/AppHeader";
import {ScreenContainer} from "@/components/common/ScreenContainer";
import {timetableService} from "@/services/timetable.service";
import {styles} from "./TimetableScreen.styles";
type Entry={_id:string;dayOfWeek:string;periodNumber:number;startTime:string;endTime:string;isBreak?:boolean;breakName?:string;subjectId?:any;teacherId?:any;classId?:any;sectionId?:any;roomId?:any;roomNumber?:string;isSubstitute?:boolean;substituteTeacher?:any};
const DAYS=["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const label=(v:any)=>typeof v==="string"?v:(v?.name||v?.fullName||[v?.firstName,v?.lastName].filter(Boolean).join(" ")||"—");
export function TimetableScreen(){
 const router=useRouter();
 const [items,setItems]=useState<Entry[]>([]);const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);const [error,setError]=useState("");const [holiday,setHoliday]=useState("");const [day,setDay]=useState(DAYS[(new Date().getDay()+6)%7]);
 const load=useCallback(async(isRefresh=false)=>{try{isRefresh?setRefreshing(true):setLoading(true);setError("");const data=await timetableService.getAll();setHoliday(data?.isHoliday?`School holiday: ${data.holidayName}`:"");setItems(Array.isArray(data)?data: data?.items||data?.timetable||[]);}catch(e:any){setError(e?.response?.data?.message||"Unable to load timetable. Please try again.");}finally{setLoading(false);setRefreshing(false);}},[]);
 useEffect(()=>{load();},[load]);
 const dayItems=useMemo(()=>items.filter(x=>x.dayOfWeek===day).sort((a,b)=>a.periodNumber-b.periodNumber),[items,day]);
 const todayDay=DAYS[(new Date().getDay()+6)%7];const selectedDayIsHoliday=Boolean(holiday)&&day===todayDay;
 return <View style={styles.root}><AppHeader title="My Timetable"/><ScreenContainer>
  <View style={styles.card}><Text style={styles.heading}>Weekly timetable</Text><Text style={styles.description}>Your live class schedule, teacher details and room information.</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroller}>{DAYS.map(d=><Pressable key={d} onPress={()=>setDay(d)} style={[styles.dayButton,day===d&&styles.dayButtonActive]}><Text style={[styles.dayText,day===d&&styles.dayTextActive]}>{d.slice(0,3)}</Text></Pressable>)}</ScrollView>
   {loading?<ActivityIndicator style={{margin:24}}/>:error?<View style={styles.message}><Text style={styles.error}>{error}</Text>{error.toLowerCase().includes("child")&&<Pressable onPress={()=>router.push("/child-switcher")}><Text style={styles.retry}>Select child</Text></Pressable>}<Pressable onPress={()=>load()}><Text style={styles.retry}>Try again</Text></Pressable></View>:selectedDayIsHoliday?<Text style={styles.empty}>School holiday: {holiday}</Text>:dayItems.length===0?<Text style={styles.empty}>{`No timetable entries for ${day.toLowerCase()}.`}</Text>:dayItems.map((item)=><View key={item._id} style={[styles.periodCard,item.isBreak&&styles.breakCard]}>
    <View style={styles.periodTime}><Text style={styles.periodNumber}>{item.isBreak?(item.breakName||"BREAK"):`Period ${item.periodNumber}`}</Text><Text style={styles.time}>{item.startTime} – {item.endTime}</Text></View>
    {!item.isBreak&&<View style={styles.periodDetails}><Text style={styles.subject}>{label(item.subjectId)}</Text><Text style={styles.detail}>Teacher: {item.isSubstitute?label(item.substituteTeacher):label(item.teacherId)}</Text><Text style={styles.detail}>Class: {label(item.classId)} · {label(item.sectionId)}</Text><Text style={styles.detail}>Room: {label(item.roomId)!=="—"?label(item.roomId):(item.roomNumber||"Not assigned")}</Text>{item.isSubstitute&&<Text style={styles.substitute}>Substitute teacher assigned</Text>}</View>}
   </View>)}
   <Pressable style={styles.refresh} onPress={()=>load(true)}><Text style={styles.refreshText}>Refresh timetable</Text></Pressable>
  </View>
 </ScreenContainer></View>;
}
