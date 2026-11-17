"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import "./DashboardShell.css";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Session storage is checked only in the browser to avoid SSR hydration issues.
    const accessToken = window.sessionStorage.getItem("mirexerp_access_token");

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setAuthChecked(true);
  }, [router, pathname]);

  useEffect(() => {
    // Close the mobile navigation after route changes.
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    // Prevent the page behind the mobile drawer from scrolling.
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  if (!authChecked) {
    return (
      <div className="dashboard-loading" role="status" aria-live="polite">
        <div className="dashboard-loading-card">
          <span className="dashboard-loading-logo" aria-hidden="true">M</span>
          <span className="dashboard-loading-spinner" aria-hidden="true" />
          <strong>Preparing your workspace</strong>
          <span className="dashboard-loading-caption">MirexERP School Management</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <a className="dashboard-skip-link" href="#dashboard-main-content">
        Skip to content
      </a>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="dashboard-main">
        <Topbar onMenu={() => setSidebarOpen((current) => !current)} />

        <main
          id="dashboard-main-content"
          className="dashboard-content"
          tabIndex={-1}
        >
          <div className="dashboard-content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
