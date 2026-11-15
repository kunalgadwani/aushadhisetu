"use client";

import { FormEvent, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/firebase";
import { PAPER_SIZES } from "@/lib/utils";
import type { ClinicSettings, ModuleKey } from "@/lib/types";

const MODULES: ModuleKey[] = [
  "patients",
  "tests",
  "medicines",
  "prescription",
  "forms",
  "bills",
  "reports",
  "receptionists",
  "settings",
];

export default function SettingsPage() {
  const { user, settings, refresh } = useApp();
  const [form, setForm] = useState<ClinicSettings | undefined>(settings);
  const [message, setMessage] = useState("");

  if (!form && settings) {
    setForm(settings);
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || !user?.clinicId) return;
    try {
      await setDoc(
        doc(db, "clinics", user.clinicId),
        {
          settings: form,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      await refresh();
      setMessage("Settings saved.");
    } catch (error) {
      console.error(error);
      setMessage("Could not save settings.");
    }
  };

  if (!form) return <p role="status">Loading settings...</p>;

  return (
    <PermissionGate module="settings">
      <form className="page-stack panel-form" onSubmit={save}>
        <label>
          Language
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value as ClinicSettings["language"] })}
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </label>
        <label>
          Theme
          <select
            value={form.theme}
            onChange={(e) => setForm({ ...form, theme: e.target.value as ClinicSettings["theme"] })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <label>
          Prescription paper size
          <select
            value={form.paperSize}
            onChange={(e) => setForm({ ...form, paperSize: e.target.value })}
          >
            {PAPER_SIZES.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label>
          Orientation
          <select
            value={form.orientation}
            onChange={(e) =>
              setForm({ ...form, orientation: e.target.value as ClinicSettings["orientation"] })
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <label>
          Header
          <input
            value={form.prescriptionHeader}
            onChange={(e) => setForm({ ...form, prescriptionHeader: e.target.value })}
          />
        </label>
        <label>
          Footer
          <input
            value={form.prescriptionFooter}
            onChange={(e) => setForm({ ...form, prescriptionFooter: e.target.value })}
          />
        </label>
        <h3>Receptionist access</h3>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>View</th>
                <th>Add</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((module) => (
                <tr key={module}>
                  <td>{module}</td>
                  {(["view", "add", "edit"] as const).map((action) => (
                    <td key={action}>
                      <input
                        type="checkbox"
                        checked={form.receptionistPermissions?.[module]?.[action] || false}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            receptionistPermissions: {
                              ...form.receptionistPermissions,
                              [module]: {
                                ...form.receptionistPermissions[module],
                                [action]: event.target.checked,
                              },
                            },
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="primary-button" type="submit">Save settings</button>
        {message && <p className="empty-note">{message}</p>}
      </form>
    </PermissionGate>
  );
}
