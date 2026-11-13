"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

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

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Patients", icon: Users },
  { name: "Medical Tests", icon: FlaskConical },
  { name: "Medicines", icon: Pill },
  { name: "Prescription", icon: FileText },
  { name: "Forms", icon: ClipboardList },
  { name: "Bills", icon: Receipt },
  { name: "Reports", icon: ChartNoAxesCombined },
  { name: "Receptionists", icon: UserRound },
  { name: "Settings", icon: Settings },
];

export default function DashboardPage() {
  const router = useRouter();

  const [activePage, setActivePage] = useState("Dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [doctorName, setDoctorName] = useState("Loading...");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [clinicCode, setClinicCode] = useState("");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace("/");
          return;
        }

        let redirecting = false;
        try {
          const userSnapshot = await getDoc(doc(db, "users", user.uid));

          if (!active) return;

          const userData = userSnapshot.data();
          if (
            !userSnapshot.exists() ||
            userData?.profileComplete !== true ||
            !userData.clinicId
          ) {
            redirecting = true;
            router.replace("/onboarding");
            return;
          }

          setDoctorName(userData.name || user.displayName || "Doctor");
          setDoctorEmail(userData.email || user.email || "");
          setClinicCode(userData.clinicCode || "");
        } catch (error) {
          console.error("Error fetching doctor details:", error);
          if (active) {
            redirecting = true;
            router.replace("/onboarding");
          }
        } finally {
          if (active && !redirecting) setAuthReady(true);
        }
      },
      (error) => {
        console.error("Authentication state check failed:", error);
        router.replace("/");
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  if (!authReady) {
    return (
      <main className="dashboard-content" role="status">
        Checking your sign-in...
      </main>
    );
  }

  const handleNavigation = (page: string) => {
    setActivePage(page);
    setMobileOpen(false);
    setProfileOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="dashboard-layout">

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`dashboard-sidebar
          ${collapsed ? "sidebar-collapsed" : ""}
          ${mobileOpen ? "mobile-sidebar-open" : ""}
        `}
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Leaf size={25} />
          </div>

          {!collapsed && (
            <div className="sidebar-brand-text">
              <h2>AushadhiSetu</h2>
              <span>Healthcare Management</span>
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

        {/* Navigation */}
        <div className="sidebar-navigation">
          {!collapsed && (
            <p className="sidebar-section-title">MAIN MENU</p>
          )}

          <nav>
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.name;

              return (
                <button
                  key={item.name}
                  className={`sidebar-nav-item ${
                    isActive ? "active" : ""
                  }`}
                  onClick={() => handleNavigation(item.name)}
                  title={collapsed ? item.name : ""}
                >
                  <Icon size={20} strokeWidth={1.8} />
                  {!collapsed && <span>{item.name}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom */}
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            {!collapsed && (
              <>
                <div className="help-icon">
                  <Leaf size={20} />
                </div>
                <strong>Care begins with connection.</strong>
                <p>Making healthcare management simpler.</p>
              </>
            )}
          </div>

          <button
            className="sidebar-collapse-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}

            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">

        {/* Header */}
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
              <h1>{activePage}</h1>
              <p>AushadhiSetu / {activePage}</p>
            </div>
          </div>

          {/* Profile Dropdown */}
          <div className="header-right">
            <div className="profile-dropdown-container">

              <button
                className={`profile-button ${
                  profileOpen ? "profile-button-active" : ""
                }`}
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
                      <strong>{doctorName}</strong>
                      <span>{doctorEmail}</span>
                    </div>
                  </div>

                  <div className="profile-dropdown-divider" />

                  <button
                    className="profile-dropdown-item"
                    onClick={() => handleNavigation("My Profile")}
                  >
                    <UserCircle size={18} />
                    <span>My Profile</span>
                  </button>

                  <button
                    className="profile-dropdown-item"
                    onClick={() => handleNavigation("Settings")}
                  >
                    <Settings size={18} />
                    <span>Settings</span>
                  </button>

                  <div className="profile-dropdown-divider" />

                  <button
                    className="profile-dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>

                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <section className="dashboard-content">

          {activePage === "Dashboard" ? (
            <div className="dashboard-welcome">
              <span className="welcome-label">
                DOCTOR WORKSPACE
              </span>

              <h2>Welcome, {doctorName}</h2>

              <p>
                Your healthcare management workspace is ready.
                Manage your clinic activities from one place.
              </p>
              {clinicCode && (
                <p className="dashboard-clinic-code">
                  Clinic ID: <strong>{clinicCode}</strong>
                </p>
              )}
            </div>
          ) : (
            <div className="dashboard-placeholder">
              <div className="placeholder-icon">
                {(() => {
                  const item = navigation.find(
                    (nav) => nav.name === activePage
                  );
                  const Icon = item?.icon ?? UserCircle;
                  return <Icon size={30} />;
                })()}
              </div>

              <h2>{activePage}</h2>

              <p>
                This section will be developed in its respective
                implementation step.
              </p>
            </div>
          )}

        </section>
      </main>
    </div>
  );
}
