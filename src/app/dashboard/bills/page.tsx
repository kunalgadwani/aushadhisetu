"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { CatalogueModal } from "@/components/CatalogueModal";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";
import { defaultMedicines, defaultTests } from "@/lib/catalogs";
import { db } from "@/lib/firebase";
import { allocateRecordId, billTotal, formatCurrency } from "@/lib/utils";
import type { BillLine, MedicineItem, TestItem } from "@/lib/types";

export default function BillsPage() {
  const { user, clinic } = useApp();
  const [patientName, setPatientName] = useState("");
  const [diagnosisFee, setDiagnosisFee] = useState("0");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [paid, setPaid] = useState("0");
  const [history, setHistory] = useState<Array<{ id: string; code: string; patientName: string; paid: number; total: number }>>([]);
  const [picker, setPicker] = useState<"medicine" | "test" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user?.clinicId) return;
    getDocs(query(collection(db, "clinics", user.clinicId, "bills"), orderBy("createdAt", "desc"))).then((snap) => {
      setHistory(
        snap.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            code: data.code,
            patientName: data.patientName,
            paid: data.paid || 0,
            total: billTotal(data.lines || []),
          };
        })
      );
    });
  }, [user?.clinicId]);

  const total = useMemo(
    () => billTotal(lines) + (Number(diagnosisFee) || 0),
    [diagnosisFee, lines]
  );
  const outstanding = Math.max(total - (Number(paid) || 0), 0);

  const saveBill = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.clinicId) return;
    const code = await allocateRecordId("bill");
    const allLines = [
      ...(Number(diagnosisFee) ? [{ description: "Diagnosis fee", quantity: 1, price: Number(diagnosisFee) }] : []),
      ...lines,
    ];
    const created = await addDoc(collection(db, "clinics", user.clinicId, "bills"), {
      clinicId: user.clinicId,
      code,
      patientName,
      lines: allLines,
      paid: Number(paid) || 0,
      createdAt: new Date(),
    });
    setHistory((current) => [
      { id: created.id, code, patientName, paid: Number(paid) || 0, total },
      ...current,
    ]);
    setMessage(`Bill ${code} saved. Outstanding ${formatCurrency(outstanding)}.`);
  };

  return (
    <PermissionGate module="bills">
      <div className="page-stack">
        <form className="panel-form" onSubmit={saveBill}>
          <div className="onboarding-field-grid">
            <label>
              Patient name
              <input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
            </label>
            <label>
              Diagnosis fee
              <input type="number" min="0" value={diagnosisFee} onChange={(e) => setDiagnosisFee(e.target.value)} />
            </label>
            <label>
              Amount paid
              <input type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setPicker("medicine")}>Add medicine</button>
            <button type="button" className="secondary-button" onClick={() => setPicker("test")}>Add test</button>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.description}-${index}`}>
                    <td>{line.description}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...line, quantity: Number(e.target.value) };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={line.price}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...line, price: Number(e.target.value) };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td>{formatCurrency(line.quantity * line.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Total {formatCurrency(total)} · Paid {formatCurrency(Number(paid) || 0)} · Outstanding {formatCurrency(outstanding)}
          </p>
          <div className="button-row">
            <button className="primary-button" type="submit">Save bill</button>
            <button className="secondary-button" type="button" onClick={() => window.print()}>Print bill</button>
          </div>
          {message && <p className="empty-note">{message}</p>}
        </form>

        <article className="print-sheet">
          <header className="rx-header">
            <h2>{clinic?.name} Invoice</h2>
            <p>{clinic?.address}</p>
            <p>Patient: {patientName}</p>
          </header>
          <ul>
            {lines.map((line) => (
              <li key={line.description}>
                {line.description} × {line.quantity} = {formatCurrency(line.quantity * line.price)}
              </li>
            ))}
          </ul>
          <p>Total: {formatCurrency(total)}</p>
        </article>

        <div className="table-card no-print-control">
          <h3>Billing history</h3>
          <table>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Patient</th>
                <th>Total</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {history.map((bill) => (
                <tr key={bill.id}>
                  <td>{bill.code}</td>
                  <td>{bill.patientName}</td>
                  <td>{formatCurrency(bill.total)}</td>
                  <td>{formatCurrency(bill.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {picker === "medicine" && (
        <CatalogueModal
          title="Add medicine"
          items={defaultMedicines}
          renderMeta={(item) => formatCurrency(item.price)}
          onClose={() => setPicker(null)}
          onSelect={(item: MedicineItem) => {
            setLines((current) => [
              ...current,
              { description: item.name, quantity: 1, price: item.price },
            ]);
            setPicker(null);
          }}
        />
      )}
      {picker === "test" && (
        <CatalogueModal
          title="Add test"
          items={defaultTests}
          onClose={() => setPicker(null)}
          onSelect={(item: TestItem) => {
            setLines((current) => [
              ...current,
              { description: item.name, quantity: 1, price: 0 },
            ]);
            setPicker(null);
          }}
        />
      )}
    </PermissionGate>
  );
}
