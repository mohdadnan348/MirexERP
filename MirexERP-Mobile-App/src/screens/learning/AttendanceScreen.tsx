import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,ScrollView,Text,View} from "react-native";
import {AppHeader} from "@/components/common/AppHeader";
import {ScreenContainer} from "@/components/common/ScreenContainer";
import {attendanceService} from "@/services/attendance.service";
import {styles} from "./AttendanceScreen.styles";
export function AttendanceScreen(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const data=await attendanceService.getAll({limit:366});setRows(Array.isArray(data)?data:data?.records||[]);}catch(e:any){setError(e?.response?.data?.message||"Unable to load attendance.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const counts=rows.reduce((acc:any,row:any)=>{const key=String(row.status||"").toUpperCase();acc[key]=(acc[key]||0)+1;return acc;},{});
 return <View style={styles.root}><AppHeader title="Attendance"/><ScreenContainer><View style={styles.card}><Text style={styles.heading}>Attendance summary</Text><Text style={styles.description}>Daily attendance records from your linked student profile.</Text>{loading?<ActivityIndicator style={{margin:20}}/>:error?<Text style={styles.placeholder}>{error}</Text>:<><View style={{flexDirection:"row",flexWrap:"wrap",gap:8,marginVertical:12}}>{["PRESENT","ABSENT","LATE","HALF_DAY","LEAVE"].map(key=><View key={key} style={{padding:10,borderRadius:10,backgroundColor:"#F1EEF8",minWidth:88}}><Text style={{fontSize:18,fontWeight:"700",color:"#30264A"}}>{counts[key]||0}</Text><Text style={{fontSize:10,color:"#756D83"}}>{key.replace("_"," ")}</Text></View>)}</View><ScrollView>{rows.map((row,index)=><View key={String(row._id||index)} style={{paddingVertical:10,borderTopWidth:1,borderTopColor:"#EEEAF4"}}><Text style={{fontWeight:"700",color:"#30264A"}}>{new Date(row.attendanceDate||row.date).toLocaleDateString("en-IN")}</Text><Text style={{fontSize:12,color:"#756D83",marginTop:3}}>{row.status}{row.remarks?` · ${row.remarks}`:""}</Text></View>)}</ScrollView></>}</View></ScreenContainer></View>;
}
