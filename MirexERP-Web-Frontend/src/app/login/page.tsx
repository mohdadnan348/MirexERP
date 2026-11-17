"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { LockKeyhole, Mail, Eye, EyeOff, AlertCircle } from "lucide-react";
import "./page.css";
export default function LoginPage() {
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setLoading(true);setError("");
    try {
      const response=await api.post("/auth/login",{email,password,rememberMe:true});
      const data=response.data?.data;
      if(!data?.accessToken) throw new Error("Login response did not contain an access token.");
      sessionStorage.setItem("mirexerp_access_token",data.accessToken);
      sessionStorage.setItem("mirexerp_refresh_token",data.refreshToken||"");
      sessionStorage.setItem("mirexerp_user",JSON.stringify(data.user||{}));
      router.replace("/dashboard");
    } catch(err:any) {setError(err?.response?.data?.message||err?.message||"Unable to sign in. Please check your credentials.");}
    finally{setLoading(false);}
  };
  return <main className="login-page"><section className="login-card">
    <img className="login-brand-logo" src="/brand/mirexerp-logo.png" alt="MirexERP School Management System" /><p className="login-eyebrow">WELCOME BACK</p><h1>Sign in</h1><p className="login-subtitle">Secure school management workspace</p>
    <form className="login-form" onSubmit={submit}>
      {error&&<div className="login-error"><AlertCircle size={16}/>{error}</div>}
      <label>Email, Student ID or Parent phone<span className="login-input-wrap"><Mail size={17}/><input type="text" required autoComplete="username" placeholder="Email / admission number / phone" value={email} onChange={e=>setEmail(e.target.value)}/></span></label>
      <label>Password<span className="login-input-wrap"><LockKeyhole size={17}/><input type={show?"text":"password"} required autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="login-toggle" onClick={()=>setShow(v=>!v)} aria-label="Toggle password">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label>
      <button type="submit" disabled={loading}>{loading?"Signing in...":"Sign in to dashboard"}</button>
    </form><p className="login-footnote">Secure access for your school team</p>
  </section></main>;
}
