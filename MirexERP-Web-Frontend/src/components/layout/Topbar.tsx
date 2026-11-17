"use client";

import {
  Bell, Menu, Search, ChevronDown, LogOut, UserRound,
  Settings, X, GraduationCap, Users, Wallet, CalendarCheck,
  BookOpen, School as SchoolIcon, ClipboardList, BarChart3
} from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { schoolsApi, type School } from "@/lib/api/schools";
import { useEffect, useMemo, useRef, useState } from "react";
import "./Topbar.css";

type TopbarProps = { onMenu: () => void };

const searchableModules = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3, keywords: "overview home" },
  { label: "Schools", href: "/schools", icon: SchoolIcon, keywords: "school campus" },
  { label: "Admissions", href: "/admissions", icon: ClipboardList, keywords: "applications enrollment" },
  { label: "Students", href: "/students", icon: GraduationCap, keywords: "pupils learners" },
  { label: "Parents & Guardians", href: "/parents", icon: Users, keywords: "family guardian" },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck, keywords: "present absent" },
  { label: "Fees & Invoices", href: "/fees", icon: Wallet, keywords: "payment collection" },
  { label: "Classes & Sections", href: "/classes", icon: BookOpen, keywords: "class section" },
  { label: "Reports", href: "/reports", icon: BarChart3, keywords: "analytics insights" },
  { label: "Settings", href: "/settings", icon: Settings, keywords: "configuration preferences" },
];

export function Topbar({ onMenu }: TopbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>({});
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [schoolLoadError, setSchoolLoadError] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setUser(JSON.parse(sessionStorage.getItem("mirexerp_user") || "{}"));
    } catch {
      setUser({});
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN") return;

    setSelectedSchoolId(sessionStorage.getItem("mirexerp_selected_school_id") || "");
    let active = true;
    schoolsApi.list({ page: 1, limit: 100 })
      .then((result) => {
        if (active) setSchools(result.schools);
      })
      .catch((error) => {
        if (active) setSchoolLoadError(error?.response?.data?.message || "Unable to load schools");
      });

    return () => { active = false; };
  }, [user?.role]);

  const handleSchoolChange = (schoolId: string) => {
    if (schoolId) sessionStorage.setItem("mirexerp_selected_school_id", schoolId);
    else sessionStorage.removeItem("mirexerp_selected_school_id");
    setSelectedSchoolId(schoolId);
    // Reload current workspace so every module refetches in the new tenant context.
    window.location.reload();
  };

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return searchableModules.slice(0, 6);
    return searchableModules.filter((item) =>
      `${item.label} ${item.keywords}`.toLowerCase().includes(value)
    ).slice(0, 7);
  }, [query]);

  const navigateTo = (href: string) => {
    router.push(href);
    setQuery("");
    setSearchOpen(false);
    setProfileOpen(false);
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    const refreshToken = sessionStorage.getItem("mirexerp_refresh_token");
    try {
      if (refreshToken) await api.post("/auth/logout", { refreshToken });
    } catch {
      // Clear the local session even if the server logout request fails.
    } finally {
      sessionStorage.removeItem("mirexerp_access_token");
      sessionStorage.removeItem("mirexerp_refresh_token");
      sessionStorage.removeItem("mirexerp_user");
      router.replace("/login");
    }
  };

  const displayName = String(user.name || user.fullName || "User");
  const role = String(user.role || "Management Portal").replaceAll("_", " ");

  return (
    <header className="topbar">
      <button className="mobile-menu" type="button" onClick={onMenu} aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <div className="topbar-search-wrap" ref={searchRef}>
        <div className="topbar-search">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) navigateTo(results[0].href);
            }}
            placeholder="Search modules..."
            aria-label="Search modules"
            aria-expanded={searchOpen}
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
          <kbd>⌘ K</kbd>
        </div>
        {searchOpen && (
          <div className="search-dropdown">
            <p className="dropdown-heading">{query ? "SEARCH RESULTS" : "QUICK ACCESS"}</p>
            {results.length ? results.map(({ label, href, icon: Icon }) => (
              <button type="button" className="search-result" key={href} onClick={() => navigateTo(href)}>
                <span className="search-result-icon"><Icon size={17} /></span>
                <span>{label}</span>
                <span className="search-result-arrow">↵</span>
              </button>
            )) : <div className="search-empty">No matching module found</div>}
          </div>
        )}
      </div>

      <div className="topbar-actions">
        {user?.role === "SUPER_ADMIN" && (
          <label className="school-context-picker">
            <span>School context</span>
            <select
              aria-label="Select school context"
              value={selectedSchoolId}
              onChange={(event) => handleSchoolChange(event.target.value)}
              title={schoolLoadError || "Choose a school to manage its data"}
            >
              <option value="">All schools (platform)</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="notification-button"
          type="button"
          aria-label="Notifications"
          title="Notifications"
          onClick={() => router.push("/communication")}
        >
          <Bell size={19} />
        </button>

        <div className="profile-wrap" ref={profileRef}>
          <button
            type="button"
            className={`profile-menu ${profileOpen ? "profile-menu-open" : ""}`}
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
            aria-label="Open account menu"
          >
            <div className="profile-avatar">{displayName.charAt(0).toUpperCase()}</div>
            <span className="profile-copy">
              <b>{displayName}</b>
              <small>{role}</small>
            </span>
            <ChevronDown className="profile-chevron" size={15} />
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-user">
                <div className="profile-avatar profile-avatar-large">{displayName.charAt(0).toUpperCase()}</div>
                <div><strong>{displayName}</strong><small>{role}</small></div>
              </div>
              <div className="profile-dropdown-divider" />
              <button type="button" onClick={() => navigateTo("/settings")}>
                <UserRound size={16} /> Account & settings
              </button>
              <button type="button" className="profile-logout" onClick={logout} disabled={loggingOut}>
                <LogOut size={16} /> {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          )}
        </div>

        <button className="logout-button" type="button" onClick={logout} title="Sign out" aria-label="Sign out" disabled={loggingOut}>
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
