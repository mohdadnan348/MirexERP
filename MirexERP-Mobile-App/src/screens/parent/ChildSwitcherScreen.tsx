import React,{useEffect,useState} from "react";
import {View,Text,Pressable,ActivityIndicator,FlatList} from "react-native";
import * as SecureStore from "expo-secure-store";
import {useRouter} from "expo-router";
import {AppHeader} from "@/components/common/AppHeader";
import {ScreenContainer} from "@/components/common/ScreenContainer";
import {api} from "@/services/api/client";
import {styles} from "./ChildSwitcherScreen.styles";
export function ChildSwitcherScreen(){
 const [children,setChildren]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [selected,setSelected]=useState("");const router=useRouter();
 useEffect(()=>{(async()=>{try{const [r,current]=await Promise.all([api.get("/parents/me/children"),SecureStore.getItemAsync("mirexerp_selected_child_id")]);const d=r.data?.data||[];setChildren(Array.isArray(d)?d:[]);setSelected(current||"");}catch(e:any){setError(e?.response?.data?.message||"Unable to load linked children.");}finally{setLoading(false);}})();},[]);
 const choose=async(id:string)=>{await SecureStore.setItemAsync("mirexerp_selected_child_id",id);router.back();};
 return <View style={styles.root}><AppHeader title="Select Child"/><ScreenContainer><View style={styles.card}><Text style={styles.heading}>Select Child</Text><Text style={styles.description}>Choose the child whose timetable and school information you want to view.</Text>{loading?<ActivityIndicator style={{margin:20}}/>:error?<Text style={styles.placeholder}>{error}</Text>:children.length===0?<Text style={styles.placeholder}>No children are linked to this parent account.</Text>:<FlatList data={children} keyExtractor={item=>item._id} renderItem={({item})=><Pressable onPress={()=>choose(item._id)} style={[styles.childRow,selected===item._id&&styles.childSelected]}><View><Text style={styles.childName}>{item.firstName} {item.lastName}</Text><Text style={styles.childMeta}>{item.admissionNumber||item.studentId||"Student"}</Text></View><Text style={styles.chooseText}>{selected===item._id?"Selected":"Select"}</Text></Pressable>}/>}</View></ScreenContainer></View>;
}
