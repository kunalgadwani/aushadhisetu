"use client";

import { useMemo, useState } from "react";
import { PermissionGate } from "@/components/PermissionGate";
import { useApp } from "@/context/AppContext";

type FormType = "sickness" | "fitness" | "consent";

export default function FormsPage() {
  const { user, clinic } = useApp();
  const [type, setType] = useState<FormType>("sickness");
  const [patientName, setPatientName] = useState("");
  const [relation, setRelation] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("Male");
  const [caste, setCaste] = useState("");
  const [occupation, setOccupation] = useState("");
  const [residence, setResidence] = useState("");
  const [disease, setDisease] = useState("");
  const [advice, setAdvice] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [days, setDays] = useState("");
  const [mark1, setMark1] = useState("");
  const [mark2, setMark2] = useState("");
  const [place, setPlace] = useState("");
  const today = useMemo(() => new Date().toLocaleDateString("en-IN"), []);

  const honorific = sex === "Female" ? "Smt/Kum" : "Shri";

  return (
    <PermissionGate module="forms">
      <div className="page-stack">
        <div className="chip-row no-print-control">
          <button className={type === "sickness" ? "primary-button" : "secondary-button"} type="button" onClick={() => setType("sickness")}>Certificate of sickness</button>
          <button className={type === "fitness" ? "primary-button" : "secondary-button"} type="button" onClick={() => setType("fitness")}>Certificate of fitness</button>
          <button className={type === "consent" ? "primary-button" : "secondary-button"} type="button" onClick={() => setType("consent")}>Consent form</button>
        </div>

        <div className="panel-form no-print-control">
          <div className="onboarding-field-grid">
            <label>Patient name<input value={patientName} onChange={(e) => setPatientName(e.target.value)} /></label>
            <label>s/w/d/o<input value={relation} onChange={(e) => setRelation(e.target.value)} /></label>
            <label>Age<input value={age} onChange={(e) => setAge(e.target.value)} /></label>
            <label>Sex
              <select value={sex} onChange={(e) => setSex(e.target.value)}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </label>
            <label>Caste<input value={caste} onChange={(e) => setCaste(e.target.value)} /></label>
            <label>Occupation<input value={occupation} onChange={(e) => setOccupation(e.target.value)} /></label>
            <label className="onboarding-full-width">Residence<input value={residence} onChange={(e) => setResidence(e.target.value)} /></label>
            {type !== "consent" && (
              <>
                <label>Disease / condition<input value={disease} onChange={(e) => setDisease(e.target.value)} /></label>
                <label>Advice / remarks<input value={advice} onChange={(e) => setAdvice(e.target.value)} /></label>
                <label>From date<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
                <label>To date<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
                <label>Absence days<input value={days} onChange={(e) => setDays(e.target.value)} /></label>
                <label>Identification mark 1<input value={mark1} onChange={(e) => setMark1(e.target.value)} /></label>
                <label>Identification mark 2<input value={mark2} onChange={(e) => setMark2(e.target.value)} /></label>
                <label>Place<input value={place} onChange={(e) => setPlace(e.target.value)} /></label>
              </>
            )}
          </div>
          <button className="primary-button" type="button" onClick={() => window.print()}>Print certificate</button>
        </div>

        <article className="print-sheet certificate">
          <header className="rx-header">
            <h2>{clinic?.name}</h2>
            <p>{clinic?.address}</p>
            <p>
              Treating Dr.: {user?.name} · Reg. No.: {clinic?.registrationNumber}
            </p>
            <p>Degree: {user?.qualification}</p>
            {type !== "consent" && (
              <p>
                Name of Patient.: {patientName} Date: {today}
                <br />
                Address: {residence}
              </p>
            )}
          </header>

          {type === "sickness" && (
            <>
              <h3>Medical certificate of sickness</h3>
              <p>
                This is to certify that I {user?.name} have personally examined {honorific}. {patientName}{" "}
                s/ w/ d/o {relation} , aged about {age} Yrs, {sex}, caste {caste} , occupation {occupation}, resident of {residence}{" "}
                (whose signature/left thumb impression is verified as under).
              </p>
              <p>
                He is suffering from (disease) {disease} and I have advised him {advice} I do consider that absence
                of {days} days with effect from i.e. from {fromDate} to {toDate} is absolutely necessary for restoration of
                him good health.
              </p>
              <p>Identification marks of patient:</p>
              <p>1. {mark1}</p>
              <p>2. {mark2}</p>
              <p>Verified Signature or Left thumb impression of the patient</p>
              <p>Date:- {today}</p>
              <p>Place:- {place}</p>
            </>
          )}

          {type === "fitness" && (
            <>
              <h3>Medical certificate of fitness</h3>
              <p>
                This is to certify that I {user?.name} have personally examined {honorific}. date patient s/
                w/ d/o {relation} , aged about {age} Yrs, {sex}, caste {caste} , occupation {occupation}, resident of {residence}{" "}
                (whose signature/left thumb impression is verified as under) and found that he has completely recovered from {disease}
              </p>
              <p>
                I also certify that before arriving at this decision, I have examined the original medical certificate and
                statement of the case on which leave was granted or extended and have taken them into consideration
                in arriving at my decision.
              </p>
              <p>Identification marks of patient:</p>
              <p>1. {mark1}</p>
              <p>2. {mark2}</p>
              <p>Verified Signature or Left thumb impression of the patient</p>
              <p>Date:- {today}</p>
              <p>Place:- {place}</p>
            </>
          )}

          {type === "consent" && (
            <>
              <h3>Consent Form</h3>
              <p>
                I am {patientName} receiving Ayurvedic treatment on my own willingness. Me & my relatives have
                been thoroughly informed about the nature of my disease and about the Ayurvedic treatment including
                Panchakarma (Vamana, Virechana, Basti, Nasya, Raktamokshna and other allied karmas etc.)
                Shodhana, Shamana Chikitsa etc. No guarantees to cure has been given to me or my relatives. So none
                of us will hold the treating Vaidyas ({user?.name}) & their assistants responsible with regard
                to cure or any untoward effects. I allow the observing, Photographing and televising of the procedure to
                be performed for medical, scientific, educational and research purpose. I also agree to co-operate fully
                with the treating Vaidyas ({user?.name}) and to follow the instructions given to me from
                time to time. I will be fully responsible for the complications due to not following them. I am signing this
                consent only after fully understanding the matter.
              </p>
              <p>Date: {today}</p>
              <p>Patient&apos;s Name: {patientName} Sign -</p>
              <p>Witness Name - Sign -</p>
            </>
          )}

          <footer className="rx-footer">
            <p>Signature -</p>
            <p>Name - {user?.name}</p>
            <p>Qualification - {user?.qualification}</p>
            <p>Registration No - {clinic?.registrationNumber}</p>
            <p>Address - {clinic?.address}</p>
            <p>Stamp -</p>
          </footer>
        </article>
      </div>
    </PermissionGate>
  );
}
