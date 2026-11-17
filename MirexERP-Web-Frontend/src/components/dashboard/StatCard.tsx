import { ArrowUpRight, Users, GraduationCap, Wallet, CalendarCheck } from "lucide-react";
import "./StatCard.css";
const icons = { purple: Users, blue: GraduationCap, gold: Wallet, green: CalendarCheck };
export function StatCard({label,value,change,tone}:{label:string;value:string;change:string;tone:keyof typeof icons}) {
 const Icon=icons[tone];
 return <article className={`stat-card stat-${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19}/></span></div><strong>{value}</strong><div className="stat-change"><ArrowUpRight size={14}/>{change}<span>vs last month</span></div></article>;
}
