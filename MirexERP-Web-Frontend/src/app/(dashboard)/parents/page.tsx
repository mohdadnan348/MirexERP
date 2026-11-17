"use client";
import Link from "next/link";
import EntityManager, { type EntityConfig } from "@/components/phase2/EntityManager";
const config: EntityConfig = {
  title: "Parent & Guardian Management", singular: "Parent", endpoint: "/parents",
  description: "Manage parent profiles, contact information and parent-to-student relationships.",
  fields: [
    { name: "firstName", label: "First name", required: true }, { name: "lastName", label: "Last name", required: true },
    { name: "email", label: "Email address", type: "email" }, { name: "phone", label: "Mobile number", type: "tel", required: true },
    { name: "alternatePhone", label: "Alternate phone", type: "tel" },
    { name: "relation", label: "Relationship", type: "select", required: true, options: ["FATHER","MOTHER","GUARDIAN","GRANDFATHER","GRANDMOTHER","OTHER"].map((v) => ({ label: v, value: v })) },
    { name: "occupation", label: "Occupation" }, { name: "qualification", label: "Qualification" },
    { name: "emergencyContact.name", label: "Emergency contact name" }, { name: "emergencyContact.relationship", label: "Emergency relationship" }, { name: "emergencyContact.phone", label: "Emergency phone" },
    { name: "annualIncome", label: "Annual income (INR)", type: "number", min: 0, step: "1" },
    { name: "studentIds", label: "Linked student IDs", placeholder: "Paste student IDs separated by commas", help: "Use student record IDs; each student is validated against this school." },
    { name: "address.street", label: "Street address" }, { name: "address.city", label: "City" },
    { name: "address.state", label: "State" }, { name: "address.postalCode", label: "PIN code" },
  ],
  columns: [{ key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" }, { key: "relation", label: "Relation" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }, { key: "studentIds.length", label: "Linked children" }],
};
export default function ParentsPage() { return <><div style={{display:"flex",gap:12,padding:"16px 24px",flexWrap:"wrap"}}><Link href="/guardian-relationships" style={{padding:"9px 12px",borderRadius:8,background:"#f0edf7",color:"#493b67"}}>Manage Guardian Access</Link><Link href="/parent-requests" style={{padding:"9px 12px",borderRadius:8,background:"#f0edf7",color:"#493b67"}}>Parent Requests</Link><Link href="/parent-account-link" style={{padding:"9px 12px",borderRadius:8,background:"#f0edf7",color:"#493b67"}}>Link Parent Login</Link></div><EntityManager config={config} /></>; }
