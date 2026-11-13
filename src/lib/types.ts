export type UserRole = "doctor" | "receptionist";

export type ModuleKey =
  | "patients"
  | "tests"
  | "medicines"
  | "prescription"
  | "forms"
  | "bills"
  | "reports"
  | "receptionists"
  | "settings";

export interface ModulePermission {
  view: boolean;
  add: boolean;
  edit: boolean;
}

export interface ClinicSettings {
  language: "en" | "hi";
  theme: "light" | "dark" | "system";
  paperSize: string;
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  prescriptionHeader: string;
  prescriptionFooter: string;
  receptionistPermissions: Record<ModuleKey, ModulePermission>;
}

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  age?: number | null;
  qualification?: string;
  specializations?: string[];
  role: UserRole;
  clinicId: string;
  clinicCode: string;
  profileComplete: boolean;
}

export interface Clinic {
  clinicId: string;
  clinicCode: string;
  ownerUid: string;
  name: string;
  address: string;
  registrationNumber: string;
  settings: ClinicSettings;
}

export interface Patient {
  id: string;
  clinicId: string;
  patientCode: string;
  opIpNumber?: string;
  name: string;
  nameLower: string;
  dateOfBirth: string;
  sex: "Male" | "Female" | "Other";
  pastHistory: string;
  habits: string;
  height?: string;
  weight?: string;
  bloodGroup?: string;
  archived: boolean;
  createdAt?: unknown;
}

export interface MedicineItem {
  id?: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  custom?: boolean;
}

export interface TestItem {
  id?: string;
  name: string;
  category: string;
  subcategories: string[];
  custom?: boolean;
}

export interface SymptomItem {
  name: string;
  description: string;
  category: string;
}

export interface PrescriptionMedicine {
  name: string;
  quantity: number;
  unit: string;
  dose: string;
  price: number;
  composition?: string;
}

export interface PrescriptionTest {
  name: string;
  subcategory: string;
  price: number;
}

export interface Prescription {
  id: string;
  clinicId: string;
  code: string;
  patientId?: string;
  patientName: string;
  patientAge?: string;
  patientSex?: string;
  complaint: string;
  diagnosis: string;
  advice: string;
  symptoms: string[];
  medicines: PrescriptionMedicine[];
  tests: PrescriptionTest[];
  printFields: string[];
  status: "draft" | "saved";
  createdAt?: unknown;
}

export interface BillLine {
  description: string;
  quantity: number;
  price: number;
}

export interface Bill {
  id: string;
  clinicId: string;
  code: string;
  patientId?: string;
  patientName: string;
  lines: BillLine[];
  paid: number;
  createdAt?: unknown;
}
