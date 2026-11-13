"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";
import { defaultTests } from "@/lib/catalogs";
import { db } from "@/lib/firebase";
import { canAccess } from "@/lib/permissions";
import { allocateRecordId } from "@/lib/utils";
import type { TestItem } from "@/lib/types";

export default function TestsPage() {
  const { user, settings } = useApp();
  const [queryText, setQueryText] = useState("");
  const [visible, setVisible] = useState(20);
  const [custom, setCustom] = useState<TestItem[]>([]);
  const [form, setForm] = useState({ name: "", category: "Laboratory", subcategories: "Standard" });

  useEffect(() => {
    if (!user?.clinicId) return;
    getDocs(collection(db, "clinics", user.clinicId, "tests")).then((snap) => {
      setCustom(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as TestItem),
        }))
      );
    });
  }, [user?.clinicId]);

  const items = useMemo(() => {
    const merged = [...custom, ...defaultTests];
    const q = queryText.trim().toLowerCase();
    return merged
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [custom, queryText]);

  const addCustom = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.clinicId || !canAccess(user, settings, "tests", "add")) return;
    const code = await allocateRecordId("test");
    const subcategories = form.subcategories.split(",").map((item) => item.trim()).filter(Boolean);
    await addDoc(collection(db, "clinics", user.clinicId, "tests"), {
      clinicId: user.clinicId,
      code,
      name: form.name.trim(),
      category: form.category,
      subcategories,
      custom: true,
    });
    setCustom((current) => [
      { name: form.name.trim(), category: form.category, subcategories, custom: true },
      ...current,
    ]);
    setForm({ name: "", category: "Laboratory", subcategories: "Standard" });
  };

  return (
    <PermissionGate module="tests">
      <div className="page-stack">
        <input
          className="search-input"
          placeholder="Search tests by name or category"
          value={queryText}
          onChange={(event) => {
            setQueryText(event.target.value);
            setVisible(20);
          }}
        />
        {canAccess(user, settings, "tests", "add") && (
          <form className="inline-form" onSubmit={addCustom}>
            <input required placeholder="Test name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input placeholder="Subcategories, comma separated" value={form.subcategories} onChange={(e) => setForm({ ...form, subcategories: e.target.value })} />
            <button className="primary-button" type="submit">Add test</button>
          </form>
        )}
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Category</th>
                <th>Subcategories</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, visible).map((item) => (
                <tr key={`${item.category}-${item.name}`}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{(item.subcategories || []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible < items.length && (
          <button className="secondary-button" onClick={() => setVisible((value) => value + 20)}>
            Load 20 more
          </button>
        )}
      </div>
    </PermissionGate>
  );
}
