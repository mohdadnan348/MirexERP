import { StyleSheet } from "react-native";
export const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:"#F7F5FC"},
 content:{paddingBottom:32},
 card:{backgroundColor:"#fff",borderRadius:18,padding:19,borderWidth:1,borderColor:"#ECE8F4",marginTop:5},
 heading:{fontSize:18,fontWeight:"800",color:"#211A35"},
 description:{fontSize:12,color:"#89839A",lineHeight:19,marginTop:8,marginBottom:14},
 input:{borderWidth:1,borderColor:"#E2DCEC",borderRadius:10,paddingHorizontal:12,paddingVertical:11,fontSize:12,color:"#211A35",marginTop:9,backgroundColor:"#fff"},
 multiline:{minHeight:75},
 switchRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:9,borderBottomWidth:1,borderBottomColor:"#F1EDF6"},
 switchLabel:{fontSize:12,color:"#514A60",flex:1,marginRight:12},
 fileButton:{padding:13,backgroundColor:"#F4EEFF",borderRadius:10,marginTop:14},
 fileText:{color:"#673AB7",fontSize:12,fontWeight:"700"},
 submitButton:{backgroundColor:"#673AB7",borderRadius:10,padding:14,alignItems:"center",marginTop:16},
 submitText:{color:"#fff",fontWeight:"800",fontSize:13},
});
