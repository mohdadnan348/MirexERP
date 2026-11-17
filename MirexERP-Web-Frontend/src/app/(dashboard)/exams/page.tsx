import { ModuleWorkspace } from "@/components/modules/ModuleWorkspace";
import { ExamMarksWorkspace } from "@/components/modules/ExamMarksWorkspace";

export default function Page() {
  return <><ModuleWorkspace moduleKey="exams"/><ExamMarksWorkspace/></>;
}
