"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import "./page.css";
export default function ForgotPasswordPage(){
 const [email,setEmail]=useState("");const [loading,setLoading]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
 const submit=async(e:FormEvent)=>{e.preventDefault();setLoading(true);setMessage("");setError("");try{const r=await api.post("/auth/forgot-password",{email});setMessage(r.data?.message||"If an account exists, password reset instructions will be sent.");}catch(err:any){setError(err?.response?.data?.message||"Unable to process request.");}finally{setLoading(false);}};
 return <main className="forgot-page"><section className="forgot-card"><h1>Forgot password?</h1><p>Enter your registered email to request password reset instructions.</p>{message&&<div className="forgot-success"><CheckCircle2 size={16}/>{message}</div>}{error&&<div className="forgot-error"><AlertCircle size={16}/>{error}</div>}<form onSubmit={submit}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@school.com"/></label><button disabled={loading}>{loading?"Sending...":"Send reset link"}</button></form><Link href="/login">Back to sign in</Link></section></main>;
}
