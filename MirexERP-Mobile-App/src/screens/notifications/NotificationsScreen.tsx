import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { styles } from "./NotificationsScreen.styles";
import { getAnnouncements } from "@/services/communications.service";

type Announcement = { _id?: string; id?: string; title?: string; message?: string; type?: string; priority?: string; publishedAt?: string; createdAt?: string; expiresAt?: string };
export function NotificationsScreen() {
 const [items,setItems]=useState<Announcement[]>([]); const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [error,setError]=useState("");
 const load=useCallback(async()=>{setError("");try{setItems(await getAnnouncements());}catch(e:any){setError(e?.response?.data?.message||"Announcements could not be loaded. Please try again.");}finally{setLoading(false);setRefreshing(false);}},[]);
 useEffect(()=>{void load();},[load]);
 return <View style={styles.root}><AppHeader title="Announcements & Alerts"/><ScreenContainer>
   <View style={styles.card}><Text style={styles.heading}>School updates</Text><Text style={styles.description}>Published announcements and notices visible to your account.</Text></View>
   {loading?<View style={styles.state}><ActivityIndicator color="#7138D5"/><Text style={styles.muted}>Loading announcements…</Text></View>:null}
   {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={()=>{setLoading(true);void load();}}><Text style={styles.retry}>Try again</Text></Pressable></View>:null}
   {!loading&&!error&&items.length===0?<View style={styles.empty}><Text style={styles.heading}>No announcements</Text><Text style={styles.muted}>New school notices will appear here when published.</Text></View>:null}
   {items.map((item,i)=><View key={item._id||item.id||String(i)} style={styles.item}><View style={styles.itemTop}><Text style={styles.type}>{String(item.type||"NOTICE").replaceAll("_"," ")}</Text><Text style={styles.date}>{item.publishedAt||item.createdAt?new Date(item.publishedAt||item.createdAt!).toLocaleDateString("en-IN"):""}</Text></View><Text style={styles.itemTitle}>{item.title||"School update"}</Text><Text style={styles.itemMessage}>{item.message||""}</Text>{item.priority&&item.priority!=="NORMAL"?<Text style={styles.priority}>{item.priority} PRIORITY</Text>:null}</View>)}
   <View style={{height:16}}/>
 </ScreenContainer></View>;
}
