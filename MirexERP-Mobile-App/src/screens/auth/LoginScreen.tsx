import React, { useState } from "react";
import { View, Text, TextInput, Image, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { AppButton } from "@/components/common/AppButton";
import { styles } from "./LoginScreen.styles";

export function LoginScreen() {
  const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false);
  const { login } = useAuth();
  const submit = async () => {
    try { setLoading(true); await login(email,password); router.replace("/(tabs)"); }
    catch { Alert.alert("Login failed","Please check your credentials and try again."); }
    finally { setLoading(false); }
  };
  return <View style={styles.page}><View style={styles.brand}><Image source={require("../../../assets/app-icon.png")} style={styles.logoImage} resizeMode="contain" /><Text style={styles.brandName}>MirexERP</Text><Text style={styles.subtitle}>School Management System</Text></View>
    <View style={styles.card}><Text style={styles.heading}>Welcome back</Text><Text style={styles.helper}>Sign in to continue to your account</Text>
      <Text style={styles.label}>Email, Student ID or Parent phone</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="default" placeholder="Email / admission number / phone"/>
      <Text style={styles.label}>Password</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter password"/>
      <AppButton title="Sign in" onPress={submit} loading={loading}/>
    </View><Text style={styles.footer}>Secure access powered by MirexERP</Text></View>;
}
