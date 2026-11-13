"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { CatalogueModal } from "@/components/CatalogueModal";
import { PermissionGate } from "@/components/PermissionGate";
import { VoiceComplaint } from "@/components/VoiceComplaint";
import { useApp } from "@/context/AppContext";
import { defaultMedicines, defaultSymptoms, defaultTests } from "@/lib/catalogs";
import { db } from "@/lib/firebase";
import { ageFromDob, allocateRecordId, PRINT_FIELDS } from "@/lib/utils";
import type { MedicineItem, PrescriptionMedicine, PrescriptionTest, TestItem } from "@/lib/types";

const DRAFT_KEY = "aushadhisetu.prescription.draft";

export default function PrescriptionPage() {
  const searchParams = useSearchParams();
  const { user, clinic, settings } = useApp();
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [patientId, setPatientId] = useState("");
  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([]);
  const [tests, setTests] = useState<PrescriptionTest[]>([]);
  const [printFields, setPrintFields] = useState<string[]>(PRINT_FIELDS.map((item) => item.id));
  const [picker, setPicker] = useState<"medicine" | "test" | "symptom" | null>(null);
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);
  const [compositionName, setCompositionName] = useState("");
  const [message, setMessage] = useState("");
  const [customMedicines, setCustomMedicines] = useState<MedicineItem[]>([]);
  const [customTests, setCustomTests] = useState<TestItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw && !searchParams.get("id") && !searchParams.get("patientId")) {
      try {
        const draft = JSON.parse(raw);
        setPatientName(draft.patientName || "");
        setPatientAge(draft.patientAge || "");
        setPatientSex(draft.patientSex || "");
        setComplaint(draft.complaint || "");
        setDiagnosis(draft.diagnosis || "");
        setAdvice(draft.advice || "");
        setSymptoms(draft.symptoms || []);
        setMedicines(draft.medicines || []);
        setTests(draft.tests || []);
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const draft = {
      patientName,
      patientAge,
      patientSex,
      complaint,
      diagnosis,
      advice,
      symptoms,
      medicines,
      tests,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [advice, complaint, diagnosis, medicines, patientAge, patientName, patientSex, symptoms, tests]);

  useEffect(() => {
    if (!user?.clinicId) return;
    getDocs(collection(db, "clinics", user.clinicId, "medicines")).then((snap) => {
      setCustomMedicines(snap.docs.map((item) => item.data() as MedicineItem));
    });
    getDocs(collection(db, "clinics", user.clinicId, "tests")).then((snap) => {
      setCustomTests(snap.docs.map((item) => item.data() as TestItem));
    });
  }, [user?.clinicId]);

  useEffect(() => {
    const load = async () => {
      if (!user?.clinicId) return;
      const existingId = searchParams.get("id");
      const linkedPatient = searchParams.get("patientId");
      if (existingId) {
        const snap = await getDoc(doc(db, "clinics", user.clinicId, "prescriptions", existingId));
        const data = snap.data();
        if (!data) return;
        setPatientId(data.patientId || "");
        setPatientName(data.patientName || "");
        setPatientAge(data.patientAge || "");
        setPatientSex(data.patientSex || "");
        setComplaint(data.complaint || "");
        setDiagnosis(data.diagnosis || "");
        setAdvice(data.advice || "");
        setSymptoms(data.symptoms || []);
        setMedicines(data.medicines || []);
        setTests(data.tests || []);
        setPrintFields(data.printFields || printFields);
      } else if (linkedPatient) {
        const snap = await getDoc(doc(db, "clinics", user.clinicId, "patients", linkedPatient));
        const data = snap.data();
        if (!data) return;
        setPatientId(snap.id);
        setPatientName(data.name || "");
        setPatientAge(ageFromDob(data.dateOfBirth || ""));
        setPatientSex(data.sex || "");
      }
    };
    load().catch(() => setMessage("Could not load prescription details."));
  }, [printFields, searchParams, user?.clinicId]);

  const medicineCatalog = useMemo(
    () => [...customMedicines, ...defaultMedicines],
    [customMedicines]
  );
  const testCatalog = useMemo(() => [...customTests, ...defaultTests], [customTests]);

  const savePrescription = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.clinicId) return;
    try {
      let linkedPatientId = patientId;
      if (!linkedPatientId && patientName.trim()) {
        const code = await allocateRecordId("patient");
        const created = await addDoc(collection(db, "clinics", user.clinicId, "patients"), {
          clinicId: user.clinicId,
          patientCode: code,
          opIpNumber: code,
          name: patientName.trim(),
          nameLower: patientName.trim().toLowerCase(),
          dateOfBirth: "",
          sex: patientSex || "Other",
          pastHistory: "",
          habits: "",
          archived: false,
          createdAt: new Date(),
        });
        linkedPatientId = created.id;
        setPatientId(created.id);
      }

      const code = await allocateRecordId("prescription");
      const payload = {
        clinicId: user.clinicId,
        code,
        patientId: linkedPatientId || null,
        patientName,
        patientAge,
        patientSex,
        complaint,
        diagnosis,
        advice,
        symptoms,
        medicines,
        tests,
        printFields,
        status: "saved",
        createdAt: new Date(),
      };
      const createdRx = await addDoc(
        collection(db, "clinics", user.clinicId, "prescriptions"),
        payload
      );
      await addDoc(collection(db, "clinics", user.clinicId, "visits"), {
        clinicId: user.clinicId,
        patientId: linkedPatientId || null,
        type: "Prescription",
        prescriptionId: createdRx.id,
        createdAt: new Date(),
      });
      localStorage.removeItem(DRAFT_KEY);
      setMessage(`Prescription ${code} saved.`);
    } catch (error) {
      console.error(error);
      setMessage("Could not save the prescription.");
    }
  };

  const printPrescription = () => window.print();

  return (
    <PermissionGate module="prescription">
      <form className="page-stack prescription-editor" onSubmit={savePrescription}>
        <div className="print-sheet" data-paper={settings?.paperSize || "A4"}>
          <header className="rx-header">
            <h2>{settings?.prescriptionHeader || clinic?.name}</h2>
            <p>{clinic?.address}</p>
            <p>
              {user?.name} · {user?.qualification} · Reg. {clinic?.registrationNumber}
            </p>
          </header>
          <div className="onboarding-field-grid no-print-control">
            <label>
              Patient name
              <input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
            </label>
            <label>
              Age
              <input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} />
            </label>
            <label>
              Sex
              <input value={patientSex} onChange={(e) => setPatientSex(e.target.value)} />
            </label>
          </div>

          <div className="master-box no-print-control">
            <strong>Master additions</strong>
            <div className="button-row">
              <button type="button" onClick={() => setPicker("symptom")}>Add symptom</button>
              <button type="button" onClick={() => setPicker("medicine")}>Add medicine</button>
              <button type="button" onClick={() => setPicker("test")}>Add test</button>
            </div>
            <div className="inline-form">
              <input
                placeholder="Composition name"
                value={compositionName}
                onChange={(e) => setCompositionName(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  if (!compositionName.trim()) return;
                  setMedicines((current) => [
                    ...current,
                    { name: compositionName.trim(), quantity: 1, unit: "composition", dose: "", price: 0, composition: compositionName.trim() },
                  ]);
                  setCompositionName("");
                }}
              >
                Add composition
              </button>
            </div>
          </div>

          <VoiceComplaint value={complaint} onChange={setComplaint} />

          {symptoms.length > 0 && (
            <section>
              <h3>Symptoms</h3>
              <ul>{symptoms.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}

          <label>
            Diagnosis
            <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </label>

          <section>
            <h3>Medicines</h3>
            {medicines.map((item, index) => (
              <div className="line-row" key={`${item.name}-${index}`}>
                <span>{item.name}</span>
                <input
                  value={item.dose}
                  placeholder="Dose"
                  onChange={(e) => {
                    const next = [...medicines];
                    next[index] = { ...item, dose: e.target.value };
                    setMedicines(next);
                  }}
                />
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...medicines];
                    next[index] = { ...item, quantity: Number(e.target.value) };
                    setMedicines(next);
                  }}
                />
                <input
                  type="number"
                  min="0"
                  value={item.price}
                  onChange={(e) => {
                    const next = [...medicines];
                    next[index] = { ...item, price: Number(e.target.value) };
                    setMedicines(next);
                  }}
                />
              </div>
            ))}
          </section>

          <section>
            <h3>Tests</h3>
            {tests.map((item, index) => (
              <div className="line-row" key={`${item.name}-${index}`}>
                <span>
                  {item.name} {item.subcategory ? `(${item.subcategory})` : ""}
                </span>
                <input
                  type="number"
                  min="0"
                  value={item.price}
                  onChange={(e) => {
                    const next = [...tests];
                    next[index] = { ...item, price: Number(e.target.value) };
                    setTests(next);
                  }}
                />
              </div>
            ))}
          </section>

          <label>
            Advice
            <textarea value={advice} onChange={(e) => setAdvice(e.target.value)} />
          </label>

          <footer className="rx-footer">
            <p>{settings?.prescriptionFooter || clinic?.address}</p>
            <p>Signature: {user?.name}</p>
          </footer>
        </div>

        <div className="no-print-control panel-form">
          <h3>Print fields</h3>
          <div className="chip-row">
            {PRINT_FIELDS.map((field) => (
              <label key={field.id} className="chip">
                <input
                  type="checkbox"
                  checked={printFields.includes(field.id)}
                  onChange={(event) => {
                    setPrintFields((current) =>
                      event.target.checked
                        ? [...current, field.id]
                        : current.filter((item) => item !== field.id)
                    );
                  }}
                />
                {field.label}
              </label>
            ))}
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">Save prescription</button>
            <button className="secondary-button" type="button" onClick={printPrescription}>
              Print preview
            </button>
          </div>
          {message && <p className="empty-note">{message}</p>}
        </div>
      </form>

      {picker === "medicine" && (
        <CatalogueModal
          title="Select medicine"
          items={medicineCatalog}
          renderMeta={(item) => `${item.category} · ${item.unit} · ₹${item.price}`}
          onClose={() => setPicker(null)}
          onSelect={(item) => {
            setMedicines((current) => [
              ...current,
              { name: item.name, quantity: 1, unit: item.unit, dose: "", price: item.price },
            ]);
            setPicker(null);
          }}
        />
      )}
      {picker === "symptom" && (
        <CatalogueModal
          title="Select symptom"
          items={defaultSymptoms}
          renderMeta={(item) => item.description}
          onClose={() => setPicker(null)}
          onSelect={(item) => {
            setSymptoms((current) => Array.from(new Set([...current, item.name])));
            setPicker(null);
          }}
        />
      )}
      {picker === "test" && !selectedTest && (
        <CatalogueModal
          title="Select test"
          items={testCatalog}
          renderMeta={(item) => item.category}
          onClose={() => setPicker(null)}
          onSelect={(item) => setSelectedTest(item)}
        />
      )}
      {selectedTest && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{selectedTest.name}</h3>
            <p>Choose a subcategory</p>
            <div className="button-row">
              {(selectedTest.subcategories || ["Standard"]).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setTests((current) => [
                      ...current,
                      { name: selectedTest.name, subcategory: sub, price: 0 },
                    ]);
                    setSelectedTest(null);
                    setPicker(null);
                  }}
                >
                  {sub}
                </button>
              ))}
            </div>
            <button className="secondary-button" type="button" onClick={() => setSelectedTest(null)}>
              Back
            </button>
          </div>
        </div>
      )}
    </PermissionGate>
  );
}
