"use client";

import { FormEvent, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useApp } from "@/context/AppContext";
import { functions } from "@/lib/firebase";

export default function ProfilePage() {
  const { user, clinic, refresh } = useApp();
  const [name, setName] = useState(user?.name || "");
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [qualification, setQualification] = useState(user?.qualification || "");
  const [specializations, setSpecializations] = useState(
    (user?.specializations || []).join(", ")
  );
  const [clinicName, setClinicName] = useState(clinic?.name || "");
  const [clinicAddress, setClinicAddress] = useState(clinic?.address || "");
  const [registrationNumber, setRegistrationNumber] = useState(
    clinic?.registrationNumber || ""
  );
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (user?.role !== "doctor") {
      setMessage("Only the clinic doctor can edit this profile.");
      return;
    }
    setLoading(true);
    try {
      const callable = httpsCallable(functions, "updateDoctorProfile");
      await callable({
        name: name.trim(),
        age: age.trim() ? Number(age) : null,
        qualification: qualification.trim(),
        specializations: specializations.split(",").map((item) => item.trim()).filter(Boolean),
        clinicName: clinicName.trim(),
        clinicAddress: clinicAddress.trim(),
        registrationNumber: registrationNumber.trim(),
      });
      await refresh();
      setMessage("Profile updated.");
    } catch (error) {
      console.error(error);
      setMessage("Could not update the profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="page-stack panel-form" onSubmit={save}>
      <p>
        Clinic ID: <strong>{user?.clinicCode}</strong> (permanent, cannot be changed)
      </p>
      <div className="onboarding-field-grid">
        <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Age <span>(optional)</span><input type="number" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} /></label>
        <label>Qualification<input value={qualification} onChange={(e) => setQualification(e.target.value)} required /></label>
        <label>Specializations<input value={specializations} onChange={(e) => setSpecializations(e.target.value)} required /></label>
        <label>Clinic name<input value={clinicName} onChange={(e) => setClinicName(e.target.value)} required /></label>
        <label>Registration number<input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required /></label>
        <label className="onboarding-full-width">
          Clinic address
          <textarea value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} required />
        </label>
      </div>
      <button className="primary-button" disabled={loading} type="submit">
        {loading ? "Saving..." : "Save profile"}
      </button>
      {message && <p className="empty-note">{message}</p>}
    </form>
  );
}
