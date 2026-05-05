export interface TaxInput {
  annualIncome: number;
  isSalaried: boolean;
  state: string;
  monthlyPetrolLitres: number;
  monthlyDieselLitres: number;
  monthlyDiscretionarySpend: number;
  annualBigPurchases: number;
}

export interface GSTRange {
  low: number;
  mid: number;
  high: number;
}

export interface FuelTaxBreakdown {
  centralExcise: number;
  stateVAT: number;
  total: number;
}

export interface TaxBreakdown {
  grossIncome: number;
  standardDeduction: number;
  taxableIncome: number;
  incomeTaxBeforeRebate: number;
  rebate87A: number;
  incomeTaxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalIncomeTax: number;
  gst: GSTRange;
  fuelTax: FuelTaxBreakdown;
  totalTax: GSTRange;
  effectiveRate: GSTRange;
}

const STANDARD_DEDUCTION = 75000;
const REBATE_87A = 60000;
const REBATE_INCOME_LIMIT = 1200000;
const CESS_RATE = 0.04;

const SLABS: Array<{ limit: number; rate: number }> = [
  { limit: 400000, rate: 0 },
  { limit: 800000, rate: 0.05 },
  { limit: 1200000, rate: 0.10 },
  { limit: 1600000, rate: 0.15 },
  { limit: 2000000, rate: 0.20 },
  { limit: 2400000, rate: 0.25 },
  { limit: Infinity, rate: 0.30 },
];

const PETROL_CENTRAL_EXCISE = 13;
const DIESEL_CENTRAL_EXCISE = 10;
const PETROL_RETAIL_AVG = 105;
const DIESEL_RETAIL_AVG = 92;
const VAT_BASE_FRACTION = 0.60;

const STATE_VAT: Record<string, number> = {
  "Delhi": 0.194,
  "Maharashtra": 0.26,
  "Karnataka": 0.295,
  "Tamil Nadu": 0.13,
  "Kerala": 0.30,
  "Andhra Pradesh": 0.31,
  "Telangana": 0.255,
  "UP": 0.268,
  "West Bengal": 0.25,
  "Gujarat": 0.135,
  "Rajasthan": 0.31,
  "Punjab": 0.234,
};

const DEFAULT_VAT = 0.25;

function getStateVAT(state: string): number {
  return STATE_VAT[state] ?? DEFAULT_VAT;
}

function computeSlabTax(taxableIncome: number): number {
  let tax = 0;
  let prevLimit = 0;

  for (const slab of SLABS) {
    if (taxableIncome <= prevLimit) break;
    const taxableInSlab = Math.min(taxableIncome, slab.limit) - prevLimit;
    tax += taxableInSlab * slab.rate;
    prevLimit = slab.limit;
  }

  return tax;
}

function computeSurcharge(tax: number, taxableIncome: number): number {
  if (taxableIncome > 20000000) return tax * 0.25;
  if (taxableIncome > 10000000) return tax * 0.15;
  if (taxableIncome > 5000000) return tax * 0.10;
  return 0;
}

function computeGST(input: TaxInput): GSTRange {
  const annualDiscretionary = input.monthlyDiscretionarySpend * 12;
  const bigPurchases = input.annualBigPurchases;

  const low = annualDiscretionary * 0.10 + bigPurchases * 0.18;
  const high = annualDiscretionary * 0.16 + bigPurchases * 0.28;
  const mid = (low + high) / 2;

  return { low, mid, high };
}

function computeFuelTax(input: TaxInput): FuelTaxBreakdown {
  const vatRate = getStateVAT(input.state);

  const annualPetrolLitres = input.monthlyPetrolLitres * 12;
  const annualDieselLitres = input.monthlyDieselLitres * 12;

  const centralExcise =
    annualPetrolLitres * PETROL_CENTRAL_EXCISE +
    annualDieselLitres * DIESEL_CENTRAL_EXCISE;

  const petrolVATBase = PETROL_RETAIL_AVG * VAT_BASE_FRACTION;
  const dieselVATBase = DIESEL_RETAIL_AVG * VAT_BASE_FRACTION;

  const stateVAT =
    annualPetrolLitres * petrolVATBase * vatRate +
    annualDieselLitres * dieselVATBase * vatRate;

  return {
    centralExcise: Math.round(centralExcise),
    stateVAT: Math.round(stateVAT),
    total: Math.round(centralExcise + stateVAT),
  };
}

export function computeTaxBreakdown(input: TaxInput): TaxBreakdown {
  const grossIncome = input.annualIncome;
  const standardDeduction = input.isSalaried ? STANDARD_DEDUCTION : 0;
  const taxableIncome = Math.max(0, grossIncome - standardDeduction);

  const incomeTaxBeforeRebate = computeSlabTax(taxableIncome);

  let rebate87A = 0;
  if (taxableIncome <= REBATE_INCOME_LIMIT) {
    rebate87A = Math.min(incomeTaxBeforeRebate, REBATE_87A);
  }

  const incomeTaxAfterRebate = incomeTaxBeforeRebate - rebate87A;
  const surcharge = computeSurcharge(incomeTaxAfterRebate, taxableIncome);
  const cess = (incomeTaxAfterRebate + surcharge) * CESS_RATE;
  const totalIncomeTax = Math.round(incomeTaxAfterRebate + surcharge + cess);

  const gst = computeGST(input);
  const fuelTax = computeFuelTax(input);

  const totalTax: GSTRange = {
    low: totalIncomeTax + gst.low + fuelTax.total,
    mid: totalIncomeTax + gst.mid + fuelTax.total,
    high: totalIncomeTax + gst.high + fuelTax.total,
  };

  const effectiveRate: GSTRange = {
    low: totalTax.low / grossIncome,
    mid: totalTax.mid / grossIncome,
    high: totalTax.high / grossIncome,
  };

  return {
    grossIncome,
    standardDeduction,
    taxableIncome,
    incomeTaxBeforeRebate: Math.round(incomeTaxBeforeRebate),
    rebate87A,
    incomeTaxAfterRebate: Math.round(incomeTaxAfterRebate),
    surcharge: Math.round(surcharge),
    cess: Math.round(cess),
    totalIncomeTax,
    gst,
    fuelTax,
    totalTax,
    effectiveRate,
  };
}
