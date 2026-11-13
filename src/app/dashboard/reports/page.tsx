"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/firebase";
import { billTotal, formatCurrency } from "@/lib/utils";

function inRange(date: Date | undefined, days: number) {
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

export default function ReportsPage() {
  const { user } = useApp();
  const [range, setRange] = useState(30);
  const [stats, setStats] = useState({
    patients: 0,
    newPatients: 0,
    visits: 0,
    revenue: 0,
  });

  useEffect(() => {
    if (!user?.clinicId) return;
    const load = async () => {
      const [patients, visits, bills] = await Promise.all([
        getDocs(collection(db, "clinics", user.clinicId, "patients")),
        getDocs(collection(db, "clinics", user.clinicId, "visits")),
        getDocs(collection(db, "clinics", user.clinicId, "bills")),
      ]);
      const toDate = (value: { toDate?: () => Date; seconds?: number }) => {
        if (value?.toDate) return value.toDate();
        if (value instanceof Date) return value;
        return undefined;
      };
      setStats({
        patients: patients.size,
        newPatients: patients.docs.filter((item) => inRange(toDate(item.data().createdAt), range)).length,
        visits: visits.docs.filter((item) => inRange(toDate(item.data().createdAt), range)).length,
        revenue: bills.docs
          .filter((item) => inRange(toDate(item.data().createdAt), range))
          .reduce((sum, item) => sum + billTotal(item.data().lines || []), 0),
      });
    };
    load().catch((error) => console.error(error));
  }, [range, user?.clinicId]);

  return (
    <PermissionGate module="reports">
      <div className="page-stack">
        <div className="chip-row">
          {[1, 7, 30, 365].map((days) => (
            <button
              key={days}
              className={range === days ? "primary-button" : "secondary-button"}
              type="button"
              onClick={() => setRange(days)}
            >
              {days === 1 ? "Daily" : days === 7 ? "Weekly" : days === 30 ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
        <div className="stats-grid">
          <article className="stat-card">
            <span>Total patients</span>
            <strong>{stats.patients}</strong>
          </article>
          <article className="stat-card">
            <span>New patients</span>
            <strong>{stats.newPatients}</strong>
          </article>
          <article className="stat-card">
            <span>Patients attended</span>
            <strong>{stats.visits}</strong>
          </article>
          <article className="stat-card">
            <span>Revenue generated</span>
            <strong>{formatCurrency(stats.revenue)}</strong>
          </article>
        </div>
        <div className="bar-chart" aria-hidden="true">
          <div style={{ height: `${Math.min(stats.visits * 8, 160)}px` }} />
          <div style={{ height: `${Math.min(stats.newPatients * 8, 160)}px` }} />
          <div style={{ height: `${Math.min(stats.revenue / 50, 160)}px` }} />
        </div>
      </div>
    </PermissionGate>
  );
}
