"use client";

import { FormEvent, useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, setDoc } from "firebase/firestore";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/firebase";

interface MemberRow {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
}

export default function ReceptionistsPage() {
  const { user, clinic } = useApp();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [attendanceNote, setAttendanceNote] = useState("");
  const [selected, setSelected] = useState("");
  const [present, setPresent] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user?.clinicId) return;
    getDocs(collection(db, "clinics", user.clinicId, "members")).then((snap) => {
      setMembers(
        snap.docs
          .map((item) => ({ id: item.id, ...(item.data() as Omit<MemberRow, "id">) }))
          .filter((item) => item.role === "receptionist")
      );
    });
  }, [user?.clinicId]);

  const setStatus = async (uid: string, status: string) => {
    if (!user?.clinicId) return;
    try {
      await setDoc(
        doc(db, "clinics", user.clinicId, "members", uid),
        {
          status,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      setMembers((current) => current.map((item) => (item.id === uid ? { ...item, status } : item)));
    } catch (error) {
      console.error(error);
      setMessage("Could not update receptionist status.");
    }
  };

  const markAttendance = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.clinicId || !selected) return;
    await addDoc(collection(db, "clinics", user.clinicId, "attendance"), {
      clinicId: user.clinicId,
      uid: selected,
      present,
      note: attendanceNote,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date(),
    });
    setMessage("Attendance saved.");
    setAttendanceNote("");
  };

  return (
    <PermissionGate module="receptionists">
      <div className="page-stack">
        <div className="dashboard-welcome">
          <p>
            Receptionists join from the sign-up screen using this permanent Clinic ID:{" "}
            <strong>{clinic?.clinicCode || user?.clinicCode}</strong>
          </p>
        </div>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>{member.status}</td>
                  <td>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setStatus(member.id, member.status === "active" ? "inactive" : "active")}
                    >
                      {member.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && <p className="empty-note">No receptionists have joined this clinic yet.</p>}
        </div>
        <form className="panel-form" onSubmit={markAttendance}>
          <h3>Attendance</h3>
          <div className="onboarding-field-grid">
            <label>
              Receptionist
              <select value={selected} onChange={(e) => setSelected(e.target.value)} required>
                <option value="">Select</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Present
              <select value={present ? "yes" : "no"} onChange={(e) => setPresent(e.target.value === "yes")}>
                <option value="yes">Present</option>
                <option value="no">Absent</option>
              </select>
            </label>
            <label className="onboarding-full-width">
              Note
              <input value={attendanceNote} onChange={(e) => setAttendanceNote(e.target.value)} />
            </label>
          </div>
          <button className="primary-button" type="submit">Save attendance</button>
          {message && <p className="empty-note">{message}</p>}
        </form>
      </div>
    </PermissionGate>
  );
}
