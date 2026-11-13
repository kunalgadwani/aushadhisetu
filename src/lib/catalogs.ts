import medicinesCatalog from "@/data/medicines.json";
import testsCatalog from "@/data/tests.json";
import symptomsCatalog from "@/data/symptoms.json";
import type { MedicineItem, SymptomItem, TestItem } from "@/lib/types";

export const defaultMedicines = medicinesCatalog as MedicineItem[];
export const defaultTests = testsCatalog as TestItem[];
export const defaultSymptoms = symptomsCatalog as SymptomItem[];

export function filterCatalog<T extends { name: string }>(
  items: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.name.toLowerCase().includes(q));
}
