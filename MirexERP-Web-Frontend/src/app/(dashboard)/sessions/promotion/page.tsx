import { Suspense } from "react";
import { AcademicSessionPromotion } from "@/components/modules/AcademicSessionTools";
export default function Page() {
  return <Suspense fallback={<div className="as-loading">Loading academic session tools…</div>}><AcademicSessionPromotion /></Suspense>;
}
