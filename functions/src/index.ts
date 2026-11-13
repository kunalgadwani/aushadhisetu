import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();

interface DoctorProfileInput {
  name: string;
  age: number | null;
  qualification: string;
  specializations: string[];
  clinicName: string;
  clinicAddress: string;
  registrationNumber: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  input: Record<string, unknown>,
  field: string,
  maxLength: number
): string {
  const value = input[field];
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }

  return normalized;
}

function parseProfileInput(value: unknown): DoctorProfileInput {
  if (!isRecord(value)) {
    throw new HttpsError("invalid-argument", "Profile details are required.");
  }

  const ageValue = value.age;
  let age: number | null = null;
  if (ageValue !== undefined && ageValue !== null && ageValue !== "") {
    if (
      typeof ageValue !== "number" ||
      !Number.isInteger(ageValue) ||
      ageValue < 18 ||
      ageValue > 100
    ) {
      throw new HttpsError("invalid-argument", "Age must be between 18 and 100.");
    }
    age = ageValue;
  }

  if (
    !Array.isArray(value.specializations) ||
    value.specializations.length === 0 ||
    value.specializations.length > 10
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Enter between 1 and 10 specializations."
    );
  }

  const specializations = value.specializations.map((specialization) => {
    if (typeof specialization !== "string") {
      throw new HttpsError("invalid-argument", "Specializations are invalid.");
    }
    const normalized = specialization.trim();
    if (!normalized || normalized.length > 80) {
      throw new HttpsError("invalid-argument", "Specializations are invalid.");
    }
    return normalized;
  });

  return {
    name: requiredString(value, "name", 120),
    age,
    qualification: requiredString(value, "qualification", 200),
    specializations: [...new Set(specializations)],
    clinicName: requiredString(value, "clinicName", 160),
    clinicAddress: requiredString(value, "clinicAddress", 500),
    registrationNumber: requiredString(value, "registrationNumber", 100),
  };
}

export const completeDoctorProfile = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to complete your profile.");
    }

    const email = request.auth.token.email;
    if (typeof email !== "string" || !email) {
      throw new HttpsError(
        "failed-precondition",
        "Your account must have an email address."
      );
    }

    const profile = parseProfileInput(request.data);
    const userId = request.auth.uid;
    const userRef = db.collection("users").doc(userId);
    const counterRef = db.collection("systemCounters").doc("clinicCodes");
    const clinicRef = db.collection("clinics").doc();
    const membershipRef = clinicRef.collection("members").doc(userId);

    return db.runTransaction(async (transaction) => {
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
          return {
            clinicId: userData.clinicId,
            clinicCode: userData.clinicCode,
          };
        }
        throw new HttpsError(
          "failed-precondition",
          "Your existing clinic profile needs administrator assistance."
        );
      }

      if (userData?.clinicId) {
        throw new HttpsError(
          "failed-precondition",
          "Your account is already linked to a clinic."
        );
      }

      const lastClinicNumber = counterSnapshot.exists
        ? counterSnapshot.data()?.lastClinicNumber
        : 0;
      if (
        typeof lastClinicNumber !== "number" ||
        !Number.isSafeInteger(lastClinicNumber) ||
        lastClinicNumber < 0 ||
        lastClinicNumber >= Number.MAX_SAFE_INTEGER
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Clinic ID allocation needs administrator setup."
        );
      }

      const nextClinicNumber = lastClinicNumber + 1;
      const clinicCode = `CLN-${String(nextClinicNumber).padStart(6, "0")}`;
      const now = FieldValue.serverTimestamp();

      transaction.set(clinicRef, {
        clinicId: clinicRef.id,
        clinicCode,
        ownerUid: userId,
        name: profile.clinicName,
        address: profile.clinicAddress,
        registrationNumber: profile.registrationNumber,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      transaction.set(membershipRef, {
        uid: userId,
        role: "doctor",
        status: "active",
        joinedAt: now,
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
          clinicId: clinicRef.id,
          clinicCode,
          profileComplete: true,
          updatedAt: now,
        },
        { merge: true }
      );

      transaction.set(counterRef, { lastClinicNumber: nextClinicNumber });

      return { clinicId: clinicRef.id, clinicCode };
    }).catch((error: unknown) => {
      if (error instanceof HttpsError) {
        logger.error("Clinic profile setup failed", { code: error.code });
        throw error;
      }

      logger.error("Clinic profile transaction failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage:
          error instanceof Error ? error.message : "Unknown transaction error",
      });
      throw new HttpsError("internal", "Clinic profile setup could not be saved.");
    });
  }
);
