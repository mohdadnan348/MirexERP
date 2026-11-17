"use client";
import { useEffect, useState } from "react";
import { ModuleWorkspace } from "@/components/modules/ModuleWorkspace";
import { TransportWorkspace } from "@/components/transport/TransportWorkspace";
export default function Page() {
 const [role,setRole]=useState("");
 useEffect(()=>{try{const u=JSON.parse(sessionStorage.getItem("mirexerp_user")||"{}");setRole(String(u.role||"").toUpperCase().replaceAll(" ","_"));}catch{setRole("");}},[]);
 if(!role) return <div className="p-6">Loading transport workspace…</div>;
 return role==="TRANSPORT_MANAGER"?<TransportWorkspace/>:<ModuleWorkspace moduleKey="transport"/>;
}
