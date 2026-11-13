"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  FlaskConical,
  Pill,
  FileText,
  ClipboardList,
  Receipt,
  ChartNoAxesCombined,
  UserRound,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  CircleUserRound,
  Leaf,
  ChevronDown,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { canAccess } from "@/lib/permissions";
import type { ModuleKey } from "@/lib/types";

const navigation: {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  key?: ModuleKey | "dashboard" | "profile";
}[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { name: "Patients", href: "/dashboard/patients", icon: Users, key: "patients" },
  { name: "Medical Tests", href: "/dashboard/tests", icon: FlaskConical, key: "tests" },
  { name: "Medicines", href: "/dashboard/medicines", icon: Pill, key: "medicines" },
  { name: "Prescription", href: "/dashboard/prescription", icon: FileText, key: "prescription" },
  { name: "Forms", href: "/dashboard/forms", icon: ClipboardList, key: "forms" },
  { name: "Bills", href: "/dashboard/bills", icon: Receipt, key: "bills" },
  { name: "Reports", href: "/dashboard/reports", icon: ChartNoAxesCombined, key: "reports" },
  { name: "Receptionists", href: "/dashboard/receptionists", icon: UserRound, key: "receptionists" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, key: "settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, clinic, settings, t, loading, logout } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (loading || !user) {
    return (
      <main className="dashboard-content" role="status">
        Checking your sign-in...
      </main>
    );
  }

  const visibleNav = navigation.filter((item) => {
    if (!item.key || item.key === "dashboard") return true;
    if (item.key === "profile") return true;
    return canAccess(user, settings, item.key, "view");
  });

  const active = visibleNav.find((item) =>
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname?.startsWith(item.href)
  );

  return (
    <div className="dashboard-layout">
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`dashboard-sidebar ${collapsed ? "sidebar-collapsed" : ""} ${
          mobileOpen ? "mobile-sidebar-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Leaf size={25} />
          </div>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <h2>AushadhiSetu</h2>
              <span>{clinic?.name || "Healthcare Management"}</span>
            </div>
          )}
          <button
            className="mobile-close-button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-navigation">
          {!collapsed && <p className="sidebar-section-title">MAIN MENU</p>}
          <nav>
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : Boolean(pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                  title={collapsed ? item.name : ""}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={20} strokeWidth={1.8} />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            {!collapsed && (
              <>
                <div className="help-icon">
                  <Leaf size={20} />
                </div>
                <strong>Care begins with connection.</strong>
                <p>Clinic ID: {user.clinicCode}</p>
              </>
            )}
          </div>
          <button
            className="sidebar-collapse-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button
              className="mobile-menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={23} />
            </button>
            <div>
              <h1>{active?.name || t.dashboard}</h1>
              <p>AushadhiSetu / {active?.name || "Workspace"}</p>
            </div>
          </div>

          <div className="header-right">
            <div className="profile-dropdown-container">
              <button
                className={`profile-button ${profileOpen ? "profile-button-active" : ""}`}
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Doctor profile menu"
                aria-expanded={profileOpen}
              >
                <CircleUserRound size={25} />
                <ChevronDown
                  size={15}
                  className={profileOpen ? "profile-chevron-open" : ""}
                />
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="profile-avatar">
                      <CircleUserRound size={30} />
                    </div>
                    <div className="profile-user-info">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <Link
                    className="profile-dropdown-item"
                    href="/dashboard/profile"
                    onClick={() => setProfileOpen(false)}
                  >
                    <UserCircle size={18} />
                    <span>{t.profile}</span>
                  </Link>
                  {canAccess(user, settings, "settings") && (
                    <Link
                      className="profile-dropdown-item"
                      href="/dashboard/settings"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Settings size={18} />
                      <span>{t.settings}</span>
                    </Link>
                  )}
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item logout-item" onClick={logout}>
                    <LogOut size={18} />
                    <span>{t.logout}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <section className="dashboard-content">{children}</section>
      </main>
    </div>
  );
}
