"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useRouter } from "next/navigation";
import { auth, db, functions } from "@/lib/firebase";

interface DoctorProfileInput {
  name: string;
  age: number | null;
  qualification: string;
  specializations: string[];
  clinicName: string;
  clinicAddress: string;
  registrationNumber: string;
}

interface ClinicProfileResult {
  clinicId: string;
  clinicCode: string;
}

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

    setLoading(true);
    try {
      const completeDoctorProfile = httpsCallable<
        DoctorProfileInput,
        ClinicProfileResult
      >(functions, "completeDoctorProfile");

      await completeDoctorProfile({
        name: name.trim(),
        age: age.trim() ? Number(age) : null,
        qualification: qualification.trim(),
        specializations: specializationList,
        clinicName: clinicName.trim(),
        clinicAddress: clinicAddress.trim(),
        registrationNumber: registrationNumber.trim(),
      });

      router.replace("/dashboard");
    } catch (error) {
      console.error("Doctor and clinic profile setup failed:", error);
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "functions/unauthenticated":
            setMessage("Your session expired. Please sign in again.");
            router.replace("/");
            break;
          case "functions/invalid-argument":
          case "functions/failed-precondition":
            setMessage(error.message);
            break;
          case "functions/unavailable":
            setMessage(
              "Profile setup is temporarily unavailable. Please try again later."
            );
            break;
          case "functions/not-found":
            setMessage(
              "The profile setup function is not deployed to this Firebase project yet. Deploy the Firebase function and try again."
            );
            break;
          case "functions/internal":
            setMessage(
              "Firebase could not complete profile setup. Confirm the function is deployed to this app's Firebase project, then check its Cloud Function logs."
            );
            break;
          default:
            setMessage(
              "We could not save your profile. Please try again; if the issue continues, contact support."
            );
        }
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
