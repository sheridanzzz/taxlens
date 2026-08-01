import type {
  RentalCategory,
  RentalProperty,
  RentalTransaction,
} from "./types";

export const RENTAL_CATEGORIES: Record<
  RentalCategory,
  { label: string; kind: "income" | "expense" }
> = {
  rent: { label: "Rent received", kind: "income" },
  other_income: { label: "Other rental income", kind: "income" },
  loan_interest: { label: "Loan interest", kind: "expense" },
  council_rates: { label: "Council rates", kind: "expense" },
  water_charges: { label: "Water charges", kind: "expense" },
  insurance: { label: "Insurance", kind: "expense" },
  property_agent_fees: { label: "Property agent fees", kind: "expense" },
  repairs_maintenance: { label: "Repairs and maintenance", kind: "expense" },
  cleaning: { label: "Cleaning", kind: "expense" },
  advertising: { label: "Advertising for tenants", kind: "expense" },
  land_tax: { label: "Land tax", kind: "expense" },
  body_corporate: { label: "Body corporate fees", kind: "expense" },
  legal_accounting: { label: "Legal and accounting", kind: "expense" },
  other_expense: { label: "Other rental expense", kind: "expense" },
};

export const rentalCategoriesFor = (kind: "income" | "expense") =>
  Object.entries(RENTAL_CATEGORIES).filter(([, category]) => category.kind === kind);

export interface RentalSummary {
  grossIncome: number;
  grossExpenses: number;
  assessableIncome: number;
  deductibleExpenses: number;
  netResult: number;
}

export const calculateRentalSummary = (
  properties: RentalProperty[],
  transactions: RentalTransaction[]
): RentalSummary => {
  const ownership = new Map(
    properties.map((property) => [
      property.id,
      Math.min(100, Math.max(0, property.ownershipPercent)) / 100,
    ])
  );

  let grossIncome = 0;
  let grossExpenses = 0;
  let assessableIncome = 0;
  let deductibleExpenses = 0;

  for (const transaction of transactions) {
    const share = ownership.get(transaction.propertyId) ?? 1;
    if (transaction.kind === "income") {
      grossIncome += transaction.amount;
      assessableIncome += transaction.amount * share;
    } else {
      grossExpenses += transaction.amount;
      deductibleExpenses +=
        transaction.amount *
        share *
        (Math.min(100, Math.max(0, transaction.deductiblePercent)) / 100);
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    grossIncome: round(grossIncome),
    grossExpenses: round(grossExpenses),
    assessableIncome: round(assessableIncome),
    deductibleExpenses: round(deductibleExpenses),
    netResult: round(assessableIncome - deductibleExpenses),
  };
};
