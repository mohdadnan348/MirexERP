"use client";
import { useEffect, useState } from "react";
import { ModuleWorkspace } from "@/components/modules/ModuleWorkspace";
import { LibrarianLibraryWorkspace } from "@/components/library/LibrarianLibraryWorkspace";
export default function Page() {
  const [isLibrarian,setIsLibrarian] = useState(false);
  const [ready,setReady] = useState(false);
  useEffect(() => {
    try { const user = JSON.parse(sessionStorage.getItem("mirexerp_user") || "{}"); setIsLibrarian(String(user.role || "").toUpperCase().replaceAll(" ","_") === "LIBRARIAN"); }
    catch { setIsLibrarian(false); }
    finally { setReady(true); }
  }, []);
  if (!ready) return <div className="module-empty">Loading library workspace…</div>;
  return isLibrarian ? <LibrarianLibraryWorkspace /> : <ModuleWorkspace moduleKey="library" />;
}
