"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";
import { defaultMedicines } from "@/lib/catalogs";
import { db } from "@/lib/firebase";
import { canAccess } from "@/lib/permissions";
import { allocateRecordId, formatCurrency } from "@/lib/utils";
import type { MedicineItem } from "@/lib/types";
import { useEffect } from "react";

export default function MedicinesPage() {
  const { user, settings } = useApp();
  const [queryText, setQueryText] = useState("");
  const [visible, setVisible] = useState(20);
  const [custom, setCustom] = useState<MedicineItem[]>([]);
  const [form, setForm] = useState({ name: "", category: "Custom", unit: "unit", price: "0" });

  useEffect(() => {
    if (!user?.clinicId) return;
    getDocs(collection(db, "clinics", user.clinicId, "medicines")).then((snap) => {
      setCustom(snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as MedicineItem) })));
    });
  }, [user?.clinicId]);

  const items = useMemo(() => {
    const merged = [...custom, ...defaultMedicines];
    const q = queryText.trim().toLowerCase();
    return merged
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [custom, queryText]);

  const addCustom = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.clinicId || !canAccess(user, settings, "medicines", "add")) return;
    const code = await allocateRecordId("medicine");
    await addDoc(collection(db, "clinics", user.clinicId, "medicines"), {
      clinicId: user.clinicId,
      code,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      price: Number(form.price) || 0,
      custom: true,
    });
    setCustom((current) => [
      { name: form.name.trim(), category: form.category, unit: form.unit, price: Number(form.price) || 0, custom: true },
      ...current,
    ]);
    setForm({ name: "", category: "Custom", unit: "unit", price: "0" });
  };

  return (
    <PermissionGate module="medicines">
      <div className="page-stack">
        <input
          className="search-input"
          placeholder="Search medicines by name or category"
          value={queryText}
          onChange={(event) => {
            setQueryText(event.target.value);
            setVisible(20);
          }}
        />
        {canAccess(user, settings, "medicines", "add") && (
          <form className="inline-form" onSubmit={addCustom}>
            <input required placeholder="Medicine name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <button className="primary-button" type="submit">Add medicine</button>
          </form>
        )}
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, visible).map((item) => (
                <tr key={`${item.category}-${item.name}-${item.unit}`}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td>{formatCurrency(item.price)}</td>
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
