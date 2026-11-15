"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

interface DoctorProfileInput {
  name: string;
  age: number | null;
  qualification: string;
  specializations: string[];
  clinicName: string;
  clinicAddress: string;
  registrationNumber: string;
}

const DEFAULT_RECEPTIONIST_PERMISSIONS = {
  patients: { view: true, add: true, edit: false },
  tests: { view: true, add: false, edit: false },
  medicines: { view: true, add: false, edit: false },
  prescription: { view: true, add: false, edit: false },
  forms: { view: true, add: true, edit: false },
  bills: { view: true, add: true, edit: true },
  reports: { view: false, add: false, edit: false },
  receptionists: { view: false, add: false, edit: false },
  settings: { view: false, add: false, edit: false },
};

const requiredProfileFields = [
  "name",
  "qualification",
  "specializations",
  "clinicName",
  "clinicAddress",
  "registrationNumber",
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [qualification, setQualification] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [message, setMessage] = useState("");

  const completion = useMemo(() => {
    const values = {
      name,
      qualification,
      specializations: specializations
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .join(","),
      clinicName,
      clinicAddress,
      registrationNumber,
    };
    const completed = requiredProfileFields.filter((field) =>
      values[field].trim()
    ).length;
    return Math.round((completed / requiredProfileFields.length) * 100);
  }, [
    clinicAddress,
    clinicName,
    name,
    qualification,
    registrationNumber,
    specializations,
  ]);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/");
        return;
      }

      let redirecting = false;
      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        if (!active) return;

        const userData = userSnapshot.data();
        if (userData?.profileComplete && userData.clinicId) {
          redirecting = true;
          router.replace("/dashboard");
          return;
        }

        setName(userData?.name || user.displayName || "");
      } catch (error) {
        console.error("Could not check doctor profile status:", error);
        if (active) {
          setMessage(
            "We could not check your saved profile. You can still try to continue; if it fails, check your connection and retry."
          );
        }
      } finally {
        if (active && !redirecting) setReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const user = auth.currentUser;
    if (!user) {
      setMessage("Your session expired. Please sign in again.");
      router.replace("/");
      return;
    }

    const email = user.email;
    if (!email) {
      setMessage("Your account must have an email address.");
      return;
    }

    const specializationList = [
      ...new Set(
        specializations
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ];

    if (specializationList.length === 0 || specializationList.length > 10) {
      setMessage("Enter between 1 and 10 specializations, separated by commas.");
      return;
    }

    const profile: DoctorProfileInput = {
      name: name.trim(),
      age: age.trim() ? Number(age) : null,
      qualification: qualification.trim(),
      specializations: specializationList,
      clinicName: clinicName.trim(),
      clinicAddress: clinicAddress.trim(),
      registrationNumber: registrationNumber.trim(),
    };

    // Validate required fields
    if (!profile.name || !profile.qualification || !profile.clinicName || !profile.clinicAddress || !profile.registrationNumber) {
      setMessage("Please fill in all required fields.");
      return;
    }

    if (profile.age !== null && (profile.age < 18 || profile.age > 100 || !Number.isInteger(profile.age))) {
      setMessage("Age must be a whole number between 18 and 100.");
      return;
    }

    setLoading(true);
    try {
      const userId = user.uid;
      const userRef = doc(db, "users", userId);
      const counterRef = doc(db, "systemCounters", "clinicCodes");

      await runTransaction(db, async (transaction) => {
        const [userSnapshot, counterSnapshot] = await Promise.all([
          transaction.get(userRef),
          transaction.get(counterRef),
        ]);

        const userData = userSnapshot.data();
        if (userData?.profileComplete === true) {
          if (
            typeof userData.clinicId === "string" &&
            typeof userData.clinicCode === "string"
          ) {
            // Already completed, just redirect
            return;
          }
          throw new Error(
            "Your existing clinic profile needs administrator assistance."
          );
        }

        if (userData?.clinicId) {
          throw new Error("Your account is already linked to a clinic.");
        }

        const lastClinicNumber = counterSnapshot.exists()
          ? counterSnapshot.data()?.lastClinicNumber ?? 0
          : 0;
        if (
          typeof lastClinicNumber !== "number" ||
          !Number.isSafeInteger(lastClinicNumber) ||
          lastClinicNumber < 0 ||
          lastClinicNumber >= Number.MAX_SAFE_INTEGER
        ) {
          throw new Error("Clinic ID allocation needs administrator setup.");
        }

        const nextClinicNumber = lastClinicNumber + 1;
        const clinicCode = `CLN-${String(nextClinicNumber).padStart(6, "0")}`;
        const now = new Date();

        // Generate a unique clinic doc ID
        const clinicDocId = `clinic_${userId}`;
        const clinicRef = doc(db, "clinics", clinicDocId);
        const membershipRef = doc(db, "clinics", clinicDocId, "members", userId);

        transaction.set(clinicRef, {
          clinicId: clinicDocId,
          clinicCode,
          ownerUid: userId,
          name: profile.clinicName,
          address: profile.clinicAddress,
          registrationNumber: profile.registrationNumber,
          status: "active",
          settings: {
            language: "en",
            theme: "system",
            paperSize: "A4",
            orientation: "portrait",
            margins: { top: 12, right: 12, bottom: 12, left: 12 },
            prescriptionHeader: profile.clinicName,
            prescriptionFooter: profile.clinicAddress,
            receptionistPermissions: DEFAULT_RECEPTIONIST_PERMISSIONS,
          },
          createdAt: now,
          updatedAt: now,
        });

        transaction.set(membershipRef, {
          uid: userId,
          role: "doctor",
          status: "active",
          name: profile.name,
          email: email.toLowerCase(),
          joinedAt: now,
        });

        transaction.set(doc(db, "clinicCodes", clinicCode), {
          clinicId: clinicDocId,
          clinicCode,
        });

        transaction.set(
          userRef,
          {
            uid: userId,
            email: email.toLowerCase(),
            name: profile.name,
            age: profile.age,
            qualification: profile.qualification,
            specializations: profile.specializations,
            role: "doctor",
            clinicId: clinicDocId,
            clinicCode,
            profileComplete: true,
            updatedAt: now,
          },
          { merge: true }
        );

        transaction.set(counterRef, { lastClinicNumber: nextClinicNumber });
      });

      router.replace("/dashboard");
    } catch (error) {
      console.error("Doctor and clinic profile setup failed:", error);
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage(
          "We could not save your profile. Please check your connection and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <main className="onboarding-page" role="status">
        Checking your account...
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <div className="onboarding-heading">
          <span className="welcome-label">DOCTOR AND CLINIC SETUP</span>
          <h1>Complete your profile</h1>
          <p>
            Add your professional and clinic details to prepare your secure
            workspace.
          </p>
        </div>

        <div className="onboarding-progress">
          <div className="onboarding-progress-label">
            <span>Profile completion</span>
            <strong>{completion}%</strong>
          </div>
          <progress value={completion} max={100}>
            {completion}%
          </progress>
        </div>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <h2>Doctor details</h2>
          <div className="onboarding-field-grid">
            <label>
              Full name
              <input
                autoComplete="name"
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>

            <label>
              Age <span>(optional)</span>
              <input
                max={100}
                min={18}
                onChange={(event) => setAge(event.target.value)}
                type="number"
                value={age}
              />
            </label>

            <label>
              Qualification
              <input
                maxLength={200}
                onChange={(event) => setQualification(event.target.value)}
                placeholder="e.g. MBBS, BAMS"
                required
                value={qualification}
              />
            </label>

            <label>
              Specializations
              <input
                maxLength={800}
                onChange={(event) => setSpecializations(event.target.value)}
                placeholder="Separate multiple entries with commas"
                required
                value={specializations}
              />
            </label>
          </div>

          <h2>Clinic details</h2>
          <div className="onboarding-field-grid">
            <label>
              Clinic or hospital name
              <input
                maxLength={160}
                onChange={(event) => setClinicName(event.target.value)}
                required
                value={clinicName}
              />
            </label>

            <label>
              Registration number
              <input
                maxLength={100}
                onChange={(event) => setRegistrationNumber(event.target.value)}
                required
                value={registrationNumber}
              />
            </label>

            <label className="onboarding-full-width">
              Clinic address
              <textarea
                autoComplete="street-address"
                maxLength={500}
                onChange={(event) => setClinicAddress(event.target.value)}
                required
                rows={3}
                value={clinicAddress}
              />
            </label>
          </div>

          {message && (
            <p className="onboarding-message" role="alert">
              {message}
            </p>
          )}

          <button
            className="onboarding-submit"
            disabled={loading}
            type="submit"
          >
            {loading ? "Saving profile..." : "Save and continue"}
          </button>
        </form>

        <p className="onboarding-security-note">
          Your clinic data will be stored in a clinic-scoped workspace.
        </p>
      </section>
    </main>
  );
}
