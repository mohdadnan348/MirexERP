import React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/common/AppHeader";
import { ScreenContainer } from "@/components/common/ScreenContainer";
import { styles } from "./ProfileScreen.styles";
export function ProfileScreen() {
 const { user, logout } = useAuth();
 const confirmLogout = () => Alert.alert("Sign out", "Are you sure you want to sign out?", [{text:"Cancel",style:"cancel"},{text:"Sign out",style:"destructive",onPress:()=>{void logout();}}]);
 return <View style={styles.root}><AppHeader title="My Profile"/><ScreenContainer>
  <View style={styles.card}><Text style={styles.heading}>{user?.name ?? "Account"}</Text><Text style={styles.description}>{user?.email ?? ""}</Text>
   <View style={styles.detail}><Text style={styles.label}>Role</Text><Text style={styles.value}>{user?.role ?? "—"}</Text></View>
   <View style={styles.detail}><Text style={styles.label}>School ID</Text><Text style={styles.value}>{user?.schoolId ?? "—"}</Text></View>
   <Pressable style={styles.logout} onPress={confirmLogout}><Text style={styles.logoutText}>Sign out</Text></Pressable>
  </View>
 </ScreenContainer></View>;
}
