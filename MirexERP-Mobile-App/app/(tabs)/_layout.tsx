import { Tabs } from "expo-router";
import { Home, CalendarCheck, BookOpen, UserRound, Bell, FileText, MessageSquare } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
export default function TabLayout() {
  const { colors } = useTheme(); const { user } = useAuth(); const role=user?.role;
  return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.primary,tabBarInactiveTintColor:"#9993AA",tabBarStyle:{height:64,paddingTop:8,paddingBottom:8,borderTopColor:"#ECE8F4",backgroundColor:"#FFFFFF"},tabBarLabelStyle:{fontSize:10,fontWeight:"600"}}}>
    <Tabs.Screen name="index" options={{title:"Home",tabBarIcon:({color,size})=><Home color={color} size={size}/>}}/>
    <Tabs.Screen name="attendance" options={{title:"Attendance",tabBarIcon:({color,size})=><CalendarCheck color={color} size={size}/>,href:role==="PARENT"||role==="STUDENT"?"/attendance":null}}/>
    <Tabs.Screen name="homework" options={{title:"Homework",tabBarIcon:({color,size})=><BookOpen color={color} size={size}/>}}/>
    <Tabs.Screen name="notifications" options={{title:"Alerts",tabBarIcon:({color,size})=><Bell color={color} size={size}/>}}/>
    <Tabs.Screen name="materials" options={{title:"Materials",tabBarIcon:({color,size})=><FileText color={color} size={size}/>,href:role==="STUDENT"?"/materials":null}}/>
    <Tabs.Screen name="parent-requests" options={{title:"Requests",tabBarIcon:({color,size})=><MessageSquare color={color} size={size}/>,href:role==="PARENT"?"/parent-requests":null}}/>
    <Tabs.Screen name="leave" options={{title:"Leave",tabBarIcon:({color,size})=><CalendarCheck color={color} size={size}/>,href:role==="TEACHER"?"/leave":null}}/>
    <Tabs.Screen name="profile" options={{title:"Profile",tabBarIcon:({color,size})=><UserRound color={color} size={size}/>}}/>
  </Tabs>;
}
