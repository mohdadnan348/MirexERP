import { Suspense } from "react";
import { AcademicSessionPreparation } from "@/components/modules/AcademicSessionTools";
export default function Page() {
  return <Suspense fallback={<div className="as-loading">Loading academic session tools…</div>}><AcademicSessionPreparation /></Suspense>;
}
