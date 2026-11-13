"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/firebase";

export default function DashboardHomePage() {
  const { user, clinic, t } = useApp();
  const [stats, setStats] = useState({
    patients: 0,
    visits: 0,
    bills: 0,
  });

  useEffect(() => {
    if (!user?.clinicId) return;
    const load = async () => {
      const clinicRef = collection(db, "clinics", user.clinicId, "patients");
      const activePatients = query(clinicRef, where("archived", "==", false));
      const visits = collection(db, "clinics", user.clinicId, "visits");
      const bills = collection(db, "clinics", user.clinicId, "bills");
      const [patientCount, visitCount, billCount] = await Promise.all([
        getCountFromServer(activePatients),
        getCountFromServer(visits),
        getCountFromServer(bills),
      ]);
      setStats({
        patients: patientCount.data().count,
        visits: visitCount.data().count,
        bills: billCount.data().count,
      });
    };
    load().catch((error) => console.error("Could not load dashboard stats:", error));
  }, [user?.clinicId]);

  return (
    <div className="page-stack">
      <div className="dashboard-welcome">
        <span className="welcome-label">DOCTOR WORKSPACE</span>
        <h2>
          {t.welcome}, {user?.name}
        </h2>
        <p>
          {clinic?.name} is ready. Manage patients, prescriptions, tests and billing from one clinic-scoped workspace.
        </p>
        <p className="dashboard-clinic-code">
          Clinic ID: <strong>{user?.clinicCode}</strong>
        </p>
      </div>
      <div className="stats-grid">
        <article className="stat-card">
          <span>Active patients</span>
          <strong>{stats.patients}</strong>
        </article>
        <article className="stat-card">
          <span>Visits recorded</span>
          <strong>{stats.visits}</strong>
        </article>
        <article className="stat-card">
          <span>Bills created</span>
          <strong>{stats.bills}</strong>
        </article>
      </div>
    </div>
  );
}
