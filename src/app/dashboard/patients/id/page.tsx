"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/firebase";
import { canAccess } from "@/lib/permissions";
import { ageFromDob } from "@/lib/utils";

interface VisitRow {
  id: string;
  type: string;
  createdAt?: { toDate?: () => Date };
  prescriptionId?: string;
  billId?: string;
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, settings } = useApp();
  const [patient, setPatient] = useState<Record<string, string | boolean> | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user?.clinicId || !params.id) return;
    const load = async () => {
      const snap = await getDoc(doc(db, "clinics", user.clinicId, "patients", params.id));
      setPatient({ id: snap.id, ...(snap.data() as Record<string, string>) });
      const visitsQuery = query(
        collection(db, "clinics", user.clinicId, "visits"),
        where("patientId", "==", params.id),
        orderBy("createdAt", "desc")
      );
      const visitSnap = await getDocs(visitsQuery);
      setVisits(visitSnap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<VisitRow, "id">) })));
    };
    load().catch(() => setMessage("Could not load this patient."));
  }, [params.id, user?.clinicId]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.clinicId || !patient) return;
    if (!canAccess(user, settings, "patients", "edit")) {
      setMessage("You can view this patient but cannot edit the record.");
      return;
    }
    await updateDoc(doc(db, "clinics", user.clinicId, "patients", patient.id as string), {
      name: patient.name,
      nameLower: (patient.name as string).toLowerCase(),
      dateOfBirth: patient.dateOfBirth,
      sex: patient.sex,
      pastHistory: patient.pastHistory || "",
      habits: patient.habits || "",
      height: patient.height || "",
      weight: patient.weight || "",
      bloodGroup: patient.bloodGroup || "",
      opIpNumber: patient.opIpNumber || patient.patientCode,
    });
    setMessage("Patient details saved.");
  };

  const toggleArchive = async () => {
    if (!user?.clinicId || !patient) return;

    const nextArchived = patient.archived !== true && patient.archived !== "true";

    await updateDoc(
      doc(db, "clinics", user.clinicId, "patients", patient.id as string),
      {
        archived: nextArchived,
      }
    );

    setPatient({ ...patient, archived: nextArchived });
  };

  if (!patient) {
    return (
      <PermissionGate module="patients">
        <div className="page-stack">
          <p role="status">Loading patient...</p>
          {message && <p className="empty-note">{message}</p>}
        </div>
      </PermissionGate>
    );
  }

  return (
    <PermissionGate module="patients">
      <div className="page-stack">
        <div className="section-toolbar">
          <div>
            <h2>{patient.name}</h2>
            <p>
              {patient.patientCode} · Age {ageFromDob(patient.dateOfBirth as string)} · {patient.sex}
            </p>
          </div>
          <div className="button-row">
            <Link className="primary-button" href={`/dashboard/prescription?patientId=${patient.id}`}>
              New visit
            </Link>
            <button className="secondary-button" type="button" onClick={toggleArchive}>
              {patient.archived ? "Restore" : "Archive"}
            </button>
          </div>
        </div>

        <form className="panel-form" onSubmit={save}>
          <div className="onboarding-field-grid">
            {["name", "dateOfBirth", "sex", "opIpNumber", "height", "weight", "bloodGroup"].map((field) => (
              <label key={field}>
                {field}
                <input
                  value={(patient[field] as string) || ""}
                  onChange={(event) => setPatient({ ...patient, [field]: event.target.value })}
                />
              </label>
            ))}
            <label className="onboarding-full-width">
              Past history
              <textarea
                value={(patient.pastHistory as string) || ""}
                onChange={(event) => setPatient({ ...patient, pastHistory: event.target.value })}
              />
            </label>
            <label className="onboarding-full-width">
              Habits
              <textarea
                value={(patient.habits as string) || ""}
                onChange={(event) => setPatient({ ...patient, habits: event.target.value })}
              />
            </label>
          </div>
          <button className="primary-button" type="submit">Save changes</button>
        </form>

        {message && <p className="empty-note">{message}</p>}

        <div className="table-card">
          <h3>Visit timeline</h3>
          <ul className="timeline">
            {visits.map((visit) => (
              <li key={visit.id}>
                <strong>{visit.type}</strong>
                <span>
                  {visit.createdAt?.toDate ? visit.createdAt.toDate().toLocaleString() : "Saved visit"}
                </span>
                {visit.prescriptionId && (
                  <Link href={`/dashboard/prescription?id=${visit.prescriptionId}`}>Prescription</Link>
                )}
                {visit.billId && <Link href={`/dashboard/bills?id=${visit.billId}`}>Bill</Link>}
              </li>
            ))}
            {visits.length === 0 && <p className="empty-note">No visits yet.</p>}
          </ul>
        </div>
      </div>
    </PermissionGate>
  );
}
