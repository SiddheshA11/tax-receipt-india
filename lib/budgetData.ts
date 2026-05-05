import budgetJson from "../data/budget-fy2627.json";

interface ExpenditureItem {
  id: string;
  category: string;
  amount: number;
  pct_total_exp: number;
  note?: string;
  source: string;
  breakdown?: Record<string, number>;
}

interface UnderspendingItem {
  scheme: string;
  unspent_cr: number;
  pct_underspent?: number;
}

interface BudgetData {
  fiscal_year: string;
  source_primary: string;
  source_official: string;
  totals: {
    total_expenditure: number;
    total_receipts_ex_borrowing: number;
    borrowing: number;
    fiscal_deficit_pct_gdp: number;
    debt_to_gdp_pct: number;
  };
  expenditure_top: ExpenditureItem[];
  committed_expenditure_pct_revenue: number;
  underspending_2025_26: UnderspendingItem[];
}

const budget: BudgetData = budgetJson as BudgetData;

export function getExpenditureCategory(id: string): ExpenditureItem | undefined {
  return budget.expenditure_top.find((item) => item.id === id);
}

export function getTotalExpenditure(): number {
  return budget.totals.total_expenditure;
}

export function getCommittedPct(): number {
  return budget.committed_expenditure_pct_revenue;
}

export function getUnderspending(): UnderspendingItem[] {
  return budget.underspending_2025_26;
}

export { budget as budgetData };
