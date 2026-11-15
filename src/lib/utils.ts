import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export function ageFromDob(dob: string): string {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "";
  if (years === 0) return `${months} mo`;
  return months ? `${years} y ${months} mo` : `${years} y`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

const RECORD_PREFIX: Record<string, string> = {
  patient: "P",
  prescription: "RX",
  bill: "BILL",
  visit: "V",
  medicine: "MED",
  test: "TST",
};

export async function allocateRecordId(kind: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to create records.");

  const prefix = RECORD_PREFIX[kind];
  if (!prefix) throw new Error("Unknown record kind.");

  // Get user doc to find clinicId
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.data();
  if (!userData?.clinicId) throw new Error("Your account is not linked to a clinic.");

  const clinicId = userData.clinicId as string;
  const counterRef = doc(db, "clinics", clinicId, "counters", kind);

  const code = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const lastNumber = snapshot.exists() ? snapshot.data()?.lastNumber ?? 0 : 0;
    if (
      typeof lastNumber !== "number" ||
      !Number.isSafeInteger(lastNumber) ||
      lastNumber < 0
    ) {
      throw new Error("Record ID allocation needs administrator setup.");
    }
    const nextNumber = lastNumber + 1;
    const generatedCode = `${prefix}-${String(nextNumber).padStart(6, "0")}`;
    transaction.set(counterRef, { lastNumber: nextNumber });
    return generatedCode;
  });

  return code;
}

export function billTotal(lines: { quantity: number; price: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
}

export const PAPER_SIZES = [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "A7",
  "A8",
  "A9",
  "A10",
] as const;

export const VOICE_LANGUAGES = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "hi-IN", label: "Hindi" },
  { id: "mr-IN", label: "Marathi" },
  { id: "gu-IN", label: "Gujarati" },
  { id: "ta-IN", label: "Tamil" },
  { id: "te-IN", label: "Telugu" },
  { id: "kn-IN", label: "Kannada" },
  { id: "ml-IN", label: "Malayalam" },
  { id: "bn-IN", label: "Bengali" },
  { id: "pa-IN", label: "Punjabi" },
  { id: "ur-IN", label: "Urdu" },
  { id: "es-ES", label: "Spanish" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
  { id: "it-IT", label: "Italian" },
  { id: "ja-JP", label: "Japanese" },
  { id: "ko-KR", label: "Korean" },
  { id: "zh-CN", label: "Chinese" },
  { id: "sa-IN", label: "Sanskrit" },
] as const;

export const PRINT_FIELDS = [
  { id: "complaint", label: "Patient's complaint" },
  { id: "symptoms", label: "Symptoms" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "medicines", label: "Medicines" },
  { id: "tests", label: "Tests" },
  { id: "advice", label: "Advice" },
] as const;
