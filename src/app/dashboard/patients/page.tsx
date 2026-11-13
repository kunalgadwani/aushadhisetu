"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/firebase";
import { canAccess } from "@/lib/permissions";
import { ageFromDob, allocateRecordId } from "@/lib/utils";

interface PatientRow {
  id: string;
  patientCode: string;
  opIpNumber?: string;
  name: string;
  dateOfBirth: string;
  sex: string;
  archived: boolean;
}

const PAGE_SIZE = 20;

export default function PatientsPage() {
  const { user, settings } = useApp();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    dateOfBirth: "",
    sex: "Male",
    pastHistory: "",
    habits: "",
    height: "",
    weight: "",
    bloodGroup: "",
    opIpNumber: "",
  });

  const clinicId = user?.clinicId;

  const loadPage = useCallback(
    async (reset = false) => {
      if (!clinicId) return;
      setLoading(true);
      try {
        const col = collection(db, "clinics", clinicId, "patients");
        const term = search.trim().toLowerCase();
        let snapshot;
        if (term) {
          const codeQuery = query(
            col,
            where("patientCode", ">=", search.trim().toUpperCase()),
            where("patientCode", "<=", `${search.trim().toUpperCase()}\uf8ff`),
            limit(PAGE_SIZE)
          );
          const nameQuery = query(
            col,
            where("nameLower", ">=", term),
            where("nameLower", "<=", `${term}\uf8ff`),
            limit(PAGE_SIZE)
          );
          const opQuery = query(
            col,
            where("opIpNumber", ">=", search.trim()),
            where("opIpNumber", "<=", `${search.trim()}\uf8ff`),
            limit(PAGE_SIZE)
          );
          const [byCode, byName, byOp] = await Promise.all([
            getDocs(codeQuery),
            getDocs(nameQuery),
            getDocs(opQuery),
          ]);
          const merged = new Map<string, PatientRow>();
          [...byCode.docs, ...byName.docs, ...byOp.docs].forEach((docSnap) => {
            merged.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as Omit<PatientRow, "id">) });
          });
          setPatients(Array.from(merged.values()));
          setDone(true);
          setLastDoc(null);
        } else {
          const constraints = [
            where("archived", "==", false),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE),
          ];
          const q = reset || !lastDoc
            ? query(col, ...constraints)
            : query(col, where("archived", "==", false), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE));
          snapshot = await getDocs(q);
          const rows = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<PatientRow, "id">),
          }));
          setPatients((current) => (reset ? rows : [...current, ...rows]));
          setLastDoc(snapshot.docs.at(-1) || null);
          setDone(snapshot.docs.length < PAGE_SIZE);
        }
      } catch (error) {
        console.error(error);
        setMessage("Could not load patients. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [clinicId, lastDoc, search]
  );

  useEffect(() => {
    setPatients([]);
    setLastDoc(null);
    setDone(false);
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setPatients([]);
    setLastDoc(null);
    loadPage(true);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!clinicId) return;
    if (!canAccess(user, settings, "patients", "add")) return;
    setMessage("");
    try {
      const patientCode = await allocateRecordId("patient");
      await addDoc(collection(db, "clinics", clinicId, "patients"), {
        clinicId,
        patientCode,
        opIpNumber: form.opIpNumber.trim() || patientCode,
        name: form.name.trim(),
        nameLower: form.name.trim().toLowerCase(),
        dateOfBirth: form.dateOfBirth,
        sex: form.sex,
        pastHistory: form.pastHistory.trim(),
        habits: form.habits.trim(),
        height: form.height.trim(),
        weight: form.weight.trim(),
        bloodGroup: form.bloodGroup.trim(),
        archived: false,
        createdAt: new Date(),
      });
      setShowForm(false);
      setForm({
        name: "",
        dateOfBirth: "",
        sex: "Male",
        pastHistory: "",
        habits: "",
        height: "",
        weight: "",
        bloodGroup: "",
        opIpNumber: "",
      });
      setPatients([]);
      setLastDoc(null);
      await loadPage(true);
    } catch (error) {
      console.error(error);
      setMessage("Could not save the patient. Please try again.");
    }
  };

  return (
    <PermissionGate module="patients">
      <div className="page-stack">
        <div className="section-toolbar">
          <form className="search-row" onSubmit={handleSearch}>
            <input
              className="search-input"
              placeholder="Search by name, patient ID or OP/IP number"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button className="primary-button" type="submit">
              Search
            </button>
          </form>
          {canAccess(user, settings, "patients", "add") && (
            <button className="primary-button" type="button" onClick={() => setShowForm(true)}>
              Add patient
            </button>
          )}
        </div>

        {message && <p className="onboarding-message">{message}</p>}

        {showForm && (
          <form className="panel-form" onSubmit={handleCreate}>
            <h3>New patient</h3>
            <div className="onboarding-field-grid">
              <label>
                Name
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                Date of birth
                <input required type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              </label>
              <label>
                Sex
                <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                OP/IP number
                <input value={form.opIpNumber} onChange={(e) => setForm({ ...form, opIpNumber: e.target.value })} placeholder="Optional, otherwise patient ID is used" />
              </label>
              <label>
                Height
                <input value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
              </label>
              <label>
                Weight
                <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              </label>
              <label>
                Blood group
                <input value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
              </label>
              <label className="onboarding-full-width">
                Past history
                <textarea value={form.pastHistory} onChange={(e) => setForm({ ...form, pastHistory: e.target.value })} />
              </label>
              <label className="onboarding-full-width">
                Habits
                <textarea value={form.habits} onChange={(e) => setForm({ ...form, habits: e.target.value })} placeholder="Drinking, smoking, etc." />
              </label>
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit">Save patient</button>
              <button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Sex</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td>{patient.patientCode}</td>
                  <td>{patient.name}</td>
                  <td>{ageFromDob(patient.dateOfBirth)}</td>
                  <td>{patient.sex}</td>
                  <td>
                    <Link href={`/dashboard/patients/${patient.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {patients.length === 0 && !loading && <p className="empty-note">No patients found.</p>}
        </div>
        {!done && !search && (
          <button className="secondary-button" disabled={loading} onClick={() => loadPage(false)}>
            {loading ? "Loading..." : "Load 20 more"}
          </button>
        )}
      </div>
    </PermissionGate>
  );
}
