"use client";
import {useEffect,useState} from "react";
import {ModuleWorkspace} from "@/components/modules/ModuleWorkspace";
import {LeaveWorkspace} from "@/components/leaves/LeaveWorkspace";
export default function Page(){
 const [role,setRole]=useState("");
 useEffect(()=>{try{setRole(String(JSON.parse(sessionStorage.getItem("mirexerp_user")||"{}").role||"").toUpperCase().replaceAll(" ","_"));}catch{setRole("");}},[]);
 if(!role)return <div className="p-6">Loading leave workspace…</div>;
 return ["SCHOOL_ADMIN","PRINCIPAL"].includes(role)?<LeaveWorkspace/>:<main className="p-6"><h1>Leave Management</h1><p>Leave approval is available to School Admin and Principal. Teacher self-service leave submission is part of the Teacher mobile app.</p></main>;
}
