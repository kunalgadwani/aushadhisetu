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

const RECORD_PREFIX: Record<string, string> = {
  patient: "P",
  prescription: "RX",
  bill: "BILL",
  visit: "V",
  medicine: "MED",
  test: "TST",
};

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

async function requireClinicMember(uid: string) {
  const userSnapshot = await db.collection("users").doc(uid).get();
  const userData = userSnapshot.data();
  if (!userData?.clinicId || typeof userData.clinicId !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "Your account is not linked to a clinic."
    );
  }

  const memberSnapshot = await db
    .collection("clinics")
    .doc(userData.clinicId)
    .collection("members")
    .doc(uid)
    .get();
  const member = memberSnapshot.data();
  if (!memberSnapshot.exists || member?.status !== "active") {
    throw new HttpsError("permission-denied", "You are not an active clinic member.");
  }

  return {
    userData,
    clinicId: userData.clinicId as string,
    role: member?.role as string,
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

    return db
      .runTransaction(async (transaction) => {
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

        transaction.set(db.collection("clinicCodes").doc(clinicCode), {
          clinicId: clinicRef.id,
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
            clinicId: clinicRef.id,
            clinicCode,
            profileComplete: true,
            updatedAt: now,
          },
          { merge: true }
        );

        transaction.set(counterRef, { lastClinicNumber: nextClinicNumber });

        return { clinicId: clinicRef.id, clinicCode };
      })
      .catch((error: unknown) => {
        if (error instanceof HttpsError) {
          logger.error("Clinic profile setup failed", { code: error.code });
          throw error;
        }

        logger.error("Clinic profile transaction failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage:
            error instanceof Error ? error.message : "Unknown transaction error",
        });
        throw new HttpsError(
          "internal",
          "Clinic profile setup could not be saved."
        );
      });
  }
);

export const updateDoctorProfile = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to update your profile.");
    }

    const profile = parseProfileInput(request.data);
    const { userData, clinicId, role } = await requireClinicMember(
      request.auth.uid
    );
    if (role !== "doctor") {
      throw new HttpsError(
        "permission-denied",
        "Only the clinic doctor can update this profile."
      );
    }

    const now = FieldValue.serverTimestamp();
    await db.collection("users").doc(request.auth.uid).set(
      {
        name: profile.name,
        age: profile.age,
        qualification: profile.qualification,
        specializations: profile.specializations,
        updatedAt: now,
      },
      { merge: true }
    );

    await db.collection("clinics").doc(clinicId).set(
      {
        name: profile.clinicName,
        address: profile.clinicAddress,
        registrationNumber: profile.registrationNumber,
        updatedAt: now,
      },
      { merge: true }
    );

    await db
      .collection("clinics")
      .doc(clinicId)
      .collection("members")
      .doc(request.auth.uid)
      .set({ name: profile.name }, { merge: true });

    return {
      clinicId,
      clinicCode: userData.clinicCode,
    };
  }
);

export const allocateRecordId = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to create records.");
    }

    if (!isRecord(request.data) || typeof request.data.kind !== "string") {
      throw new HttpsError("invalid-argument", "Record kind is required.");
    }

    const prefix = RECORD_PREFIX[request.data.kind];
    if (!prefix) {
      throw new HttpsError("invalid-argument", "Unknown record kind.");
    }

    const { clinicId } = await requireClinicMember(request.auth.uid);
    const counterRef = db
      .collection("clinics")
      .doc(clinicId)
      .collection("counters")
      .doc(request.data.kind);

    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(counterRef);
      const lastNumber = snapshot.exists ? snapshot.data()?.lastNumber : 0;
      if (
        typeof lastNumber !== "number" ||
        !Number.isSafeInteger(lastNumber) ||
        lastNumber < 0
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Record ID allocation needs administrator setup."
        );
      }

      const nextNumber = lastNumber + 1;
      const code = `${prefix}-${String(nextNumber).padStart(6, "0")}`;
      transaction.set(counterRef, { lastNumber: nextNumber });
      return { code, clinicId };
    });
  }
);

export const joinClinicAsReceptionist = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to join a clinic.");
    }

    if (!isRecord(request.data)) {
      throw new HttpsError("invalid-argument", "Clinic details are required.");
    }

    const clinicCode = requiredString(request.data, "clinicCode", 20).toUpperCase();
    const name = requiredString(request.data, "name", 120);
    const email = request.auth.token.email;
    if (typeof email !== "string" || !email) {
      throw new HttpsError(
        "failed-precondition",
        "Your account must have an email address."
      );
    }

    const codeSnapshot = await db.collection("clinicCodes").doc(clinicCode).get();
    const clinicId = codeSnapshot.data()?.clinicId;
    if (!codeSnapshot.exists || typeof clinicId !== "string") {
      throw new HttpsError("not-found", "No clinic was found for that Clinic ID.");
    }

    const userRef = db.collection("users").doc(request.auth.uid);
    const memberRef = db
      .collection("clinics")
      .doc(clinicId)
      .collection("members")
      .doc(request.auth.uid);

    return db.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      const userData = userSnapshot.data();
      if (userData?.clinicId && userData.clinicId !== clinicId) {
        throw new HttpsError(
          "failed-precondition",
          "This account is already linked to another clinic."
        );
      }

      const now = FieldValue.serverTimestamp();
      transaction.set(memberRef, {
        uid: request.auth.uid,
        role: "receptionist",
        status: "active",
        name,
        email: email.toLowerCase(),
        joinedAt: now,
      });
      transaction.set(
        userRef,
        {
          uid: request.auth.uid,
          email: email.toLowerCase(),
          name,
          role: "receptionist",
          clinicId,
          clinicCode,
          profileComplete: true,
          updatedAt: now,
        },
        { merge: true }
      );

      return { clinicId, clinicCode };
    });
  }
);

export const updateClinicSettings = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to update settings.");
    }

    const { clinicId, role } = await requireClinicMember(request.auth.uid);
    if (role !== "doctor") {
      throw new HttpsError(
        "permission-denied",
        "Only the clinic doctor can update settings."
      );
    }

    if (!isRecord(request.data) || !isRecord(request.data.settings)) {
      throw new HttpsError("invalid-argument", "Settings are required.");
    }

    await db.collection("clinics").doc(clinicId).set(
      {
        settings: request.data.settings,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  }
);

export const setReceptionistStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to manage staff.");
    }

    const { clinicId, role } = await requireClinicMember(request.auth.uid);
    if (role !== "doctor") {
      throw new HttpsError(
        "permission-denied",
        "Only the clinic doctor can manage receptionists."
      );
    }

    if (
      !isRecord(request.data) ||
      typeof request.data.uid !== "string" ||
      typeof request.data.status !== "string"
    ) {
      throw new HttpsError("invalid-argument", "Staff details are required.");
    }

    if (!["active", "inactive"].includes(request.data.status)) {
      throw new HttpsError("invalid-argument", "Status is invalid.");
    }

    await db
      .collection("clinics")
      .doc(clinicId)
      .collection("members")
      .doc(request.data.uid)
      .set(
        {
          status: request.data.status,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return { ok: true };
  }
);
