
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  FieldValue,
} from "firebase-admin/firestore";

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

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Firebase Authentication
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const token = authorization.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);

    const userId = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) {
      return NextResponse.json(
        { error: "Your account must have an email address." },
        { status: 400 }
      );
    }

    // 2. Validate submitted profile
    const body = await request.json();

    const {
      name,
      age,
      qualification,
      specializations,
      clinicName,
      clinicAddress,
      registrationNumber,
    } = body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof qualification !== "string" ||
      !qualification.trim() ||
      !Array.isArray(specializations) ||
      specializations.length < 1 ||
      specializations.length > 10 ||
      !specializations.every(
        (item: unknown) =>
          typeof item === "string" && item.trim().length > 0
      ) ||
      typeof clinicName !== "string" ||
      !clinicName.trim() ||
      typeof clinicAddress !== "string" ||
      !clinicAddress.trim() ||
      typeof registrationNumber !== "string" ||
      !registrationNumber.trim() ||
      !(
        age === null ||
        (typeof age === "number" &&
          Number.isInteger(age) &&
          age >= 18 &&
          age <= 100)
      )
    ) {
      return NextResponse.json(
        { error: "Please provide valid profile details." },
        { status: 400 }
      );
    }

    // 3. Allocate clinic ID and save everything atomically
    const userRef = adminDb.collection("users").doc(userId);
    const counterRef = adminDb
      .collection("systemCounters")
      .doc("clinicCodes");

    const result = await adminDb.runTransaction(async (transaction) => {
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

        throw new Error(
          "Your existing clinic profile needs administrator assistance."
        );
      }

      if (userData?.clinicId) {
        throw new Error("Your account is already linked to a clinic.");
      }

      const lastClinicNumber = counterSnapshot.exists
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
      const clinicId = `clinic_${userId}`;

      const clinicRef = adminDb.collection("clinics").doc(clinicId);
      const membershipRef = clinicRef
        .collection("members")
        .doc(userId);

      const codeRef = adminDb
        .collection("clinicCodes")
        .doc(clinicCode);

      const now = FieldValue.serverTimestamp();

      transaction.create(clinicRef, {
        clinicId,
        clinicCode,
        ownerUid: userId,
        name: clinicName.trim(),
        address: clinicAddress.trim(),
        registrationNumber: registrationNumber.trim(),
        status: "active",
        settings: {
          language: "en",
          theme: "system",
          paperSize: "A4",
          orientation: "portrait",
          margins: {
            top: 12,
            right: 12,
            bottom: 12,
            left: 12,
          },
          prescriptionHeader: clinicName.trim(),
          prescriptionFooter: clinicAddress.trim(),
          receptionistPermissions: DEFAULT_RECEPTIONIST_PERMISSIONS,
        },
        createdAt: now,
        updatedAt: now,
      });

      transaction.create(membershipRef, {
        uid: userId,
        role: "doctor",
        status: "active",
        name: name.trim(),
        email: email.toLowerCase(),
        joinedAt: now,
      });

      transaction.create(codeRef, {
        clinicId,
        clinicCode,
      });

      transaction.set(
        userRef,
        {
          uid: userId,
          email: email.toLowerCase(),
          name: name.trim(),
          age,
          qualification: qualification.trim(),
          specializations: specializations.map(
            (item: string) => item.trim()
          ),
          role: "doctor",
          clinicId,
          clinicCode,
          profileComplete: true,
          updatedAt: now,
        },
        { merge: true }
      );

      transaction.set(counterRef, {
        lastClinicNumber: nextClinicNumber,
      });

      return { clinicId, clinicCode };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Onboarding API error:", error);

    const message =
      error instanceof Error ? error.message : "Profile setup failed.";

    const status =
      message.includes("already") ||
      message.includes("needs administrator")
        ? 409
        : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
