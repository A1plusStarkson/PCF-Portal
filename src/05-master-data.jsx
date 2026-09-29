/* ---------------------------------------------------------------------------
   BRANCH MASTER
   Branch ID / Branch Name / Company Name exactly as maintained by Accounting.
   Company names were rebranded in Sept 2026 (Starkson Paper and Plastic
   Corporation -> Starkson Packaging, Inc.; A1+ Paper and Plastic Inc. ->
   A1+ Multinational Packaging, Inc). Records already filed keep their branch
   CODE, so the rename flows through history, reports and Acumatica unchanged.
--------------------------------------------------------------------------- */
const BRANCHES = [
  {
    "code": "ST",
    "name": "Starkson Packaging, Inc.",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "D1",
    "name": "Disney 1",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "D2",
    "name": "Disney 2",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "D3",
    "name": "Disney 3",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "D8",
    "name": "Disney 8",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "D5",
    "name": "Disney 5",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "D6",
    "name": "Disney 6",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "D7",
    "name": "Disney 7",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "D9",
    "name": "Disney 9",
    "company": "Starkson Packaging, Inc."
  },
  {
    "code": "A1+",
    "name": "A1+ Multinational Packaging, Inc",
    "company": "A1+ Multinational Packaging, Inc"
  },
  {
    "code": "HASBRO",
    "name": "Hasbro",
    "company": "A1+ Multinational Packaging, Inc"
  },
  {
    "code": "SITIO",
    "name": "Sitio",
    "company": "A1+ Multinational Packaging, Inc"
  },
  {
    "code": "MATTEL",
    "name": "Mattel",
    "company": "A1+ Multinational Packaging, Inc"
  },
  {
    "code": "PERULANDIA",
    "name": "Perulandia",
    "company": "A1+ Multinational Packaging, Inc"
  },
  {
    "code": "EURASIA",
    "name": "Eurasia",
    "company": "A1+ Multinational Packaging, Inc"
  },
  {
    "code": "STINDUSTRY",
    "name": "Starkson Industries Inc.",
    "company": "Starkson Industries Inc."
  },
  {
    "code": "WARNER",
    "name": "Warner",
    "company": "A1+ Multinational Packaging, Inc"
  },
  {
    "code": "HAMFI(HO)",
    "name": "Happy Alliance Mono Film, Inc.",
    "company": "Happy Alliance Mono Film, Inc."
  },
  /* Not in the Accounting branch sheet, but the RG and Co. petty cash fund is
     filed against this code — dropping it would orphan that whole plant. */
  {
    "code": "RG",
    "name": "RG and Co.",
    "company": "RG & Co. Property Management Corporation"
  }
];

const COMPANIES = [
  "A1+ Multinational Packaging, Inc",
  "Starkson Packaging, Inc.",
  "Happy Alliance Mono Film, Inc.",
  "Starkson Industries Inc.",
  "RG & Co. Property Management Corporation"
];

/* ---------------------------------------------------------------------------
   COMPANY PROFILE REGISTRY (part of the Fund & Master Data module)
   Single source of truth for report branding + signatories. The Report Center
   reads the logo, reviewer and approver straight from here based on the company
   resolved from the selected Plant — so nothing is hardcoded in the report
   template and any new company/plant is picked up automatically.
--------------------------------------------------------------------------- */
const DEFAULT_REVIEWER = "Manager";
const DEFAULT_APPROVER = "Grace P. Gan";
const DEFAULT_APPROVER_ROLE = "Finance Director";
const COMPANY_PROFILES = {
  "A1+ Multinational Packaging, Inc": {
    logo: REPORT_LOGO_A1, reviewer: DEFAULT_REVIEWER, approver: DEFAULT_APPROVER, approverRole: DEFAULT_APPROVER_ROLE,
  },
  "Starkson Packaging, Inc.": {
    logo: REPORT_LOGO, reviewer: DEFAULT_REVIEWER, approver: DEFAULT_APPROVER, approverRole: DEFAULT_APPROVER_ROLE,
  },
  "Happy Alliance Mono Film, Inc.": {
    logo: REPORT_LOGO_HAMFI, reviewer: DEFAULT_REVIEWER, approver: DEFAULT_APPROVER, approverRole: DEFAULT_APPROVER_ROLE,
  },
  "RG & Co. Property Management Corporation": {
    logo: REPORT_LOGO_RG, reviewer: DEFAULT_REVIEWER, approver: DEFAULT_APPROVER, approverRole: DEFAULT_APPROVER_ROLE,
  },
  /* Pre-rename names kept so a report generated against a historical record
     still finds the right branding instead of falling back to the heuristic. */
  "A1+ Paper and Plastic Inc.": {
    logo: REPORT_LOGO_A1, reviewer: DEFAULT_REVIEWER, approver: DEFAULT_APPROVER, approverRole: DEFAULT_APPROVER_ROLE,
  },
  "Starkson Paper and Plastic Corporation": {
    logo: REPORT_LOGO, reviewer: DEFAULT_REVIEWER, approver: DEFAULT_APPROVER, approverRole: DEFAULT_APPROVER_ROLE,
  },
};
/* Resolve the branding/signatory profile for a company (null when unknown so
   callers can fall back to sensible defaults). */
const companyProfile = (company) => COMPANY_PROFILES[company] || null;

/* The four operating petty-cash plants used for plant-scoped access control,
   per-plant dashboards, and the plant selector shown inside each module. */
/* This IS the "Petty Cash Funds (Plants)" master sheet: plant, branch, company
   (via the branch master), custodian and beginning balance. seedFunds() in
   02-helpers.jsx builds the fund rows straight from here, so the numbers live in
   exactly one place. `fundId` is the stable record id — never renumber it, or a
   database that already holds that fund would gain a duplicate. */
const PLANTS = [
  { key: "MNL", fundId: "fund-MNL", code: "A1+", label: "Manila", custodian: "Maureen Felix", beginningBalance: 600000 },
  { key: "WARNER", fundId: "fund-WAR", code: "WARNER", label: "Warner", custodian: "Angelita Bayani", beginningBalance: 70000 },
  /* Disney's fund is filed against the Starkson company branch (ST), not D1 —
     D1..D9 are sub-locations that draw on it (see PLANT_FAMILIES below). */
  { key: "DISNEY", fundId: "fund-DIS", code: "ST", label: "Disney", custodian: "Pura Barloso", beginningBalance: 700000 },
  { key: "RG", fundId: "fund-RG", code: "RG", label: "RG and Co.", custodian: "Pura Barloso", beginningBalance: 300000 },
];
const PLANT_CODES = PLANTS.map((p) => p.code);
/* Display name for a branch code: the plant label when it is one of the four
   fund-holding plants, else the branch master's name (so D2 reads "Disney 2"
   rather than a bare code), else the code itself. */
const plantLabel = (code) => (PLANTS.find((p) => p.code === code) || {}).label
  || (BRANCHES.find((b) => b.code === code) || {}).name
  || code;
/* Resolve a user's allowed branch list: "ALL" -> every branch, an explicit
   grant -> the full plant family of each code named (see resolvePlants below).
   A grant may name any branch from BRANCHES (e.g. Disney is D1..D9), not just
   the four fund-holding plant codes, so validate against the full branch
   master — a narrower check silently hid the extra branches in User
   Management. */
const BRANCH_CODE_SET = new Set(BRANCHES.map((b) => b.code).concat(PLANT_CODES));
/* Every branch code the system knows about. "ALL" resolves to this, NOT to the
   four plant codes: a grant of only the fund-holding codes meant a record filed
   against a sub-branch (HASBRO, D5, …) fell outside inScope() for management,
   so Accounting and Finance could not see records their own requestors had
   filed — the same database showing two different dashboards. */
const ALL_BRANCH_CODES = Array.from(new Set(BRANCHES.map((b) => b.code).concat(PLANT_CODES)));

/* ---- Plant families ----
   A plant is a site that HOLDS a petty cash fund; the branches listed under it
   are sub-locations that draw on that same fund (Disney 2..9 all settle against
   the single Disney fund, Hasbro/Sitio/Mattel/Perulandia against Manila's).

   Access, the sidebar and the per-plant dashboard all work on the FAMILY, so
   granting someone a plant always grants the whole family. That is what keeps
   every user's view of the same data identical: a sub-branch can never hold a
   record that is visible to one member of a plant and hidden from another.

   Note the families line up with the company master: the Disney family is
   exactly the branch list of Starkson Packaging, Inc., and the Manila family is
   A1+ Multinational Packaging, Inc minus Warner, which holds its own fund and
   its own custodian.

   The Disney family is keyed on ST (the company branch that actually holds the
   fund). D1 stays inside the family, so vouchers already filed against D1..D9
   keep rolling up to the same plant and nothing goes missing. */
const PLANT_FAMILIES = [
  { plant: "A1+",    branches: ["A1+", "EURASIA", "HASBRO", "SITIO", "MATTEL", "PERULANDIA"] },
  { plant: "WARNER", branches: ["WARNER"] },
  { plant: "ST",     branches: ["ST", "D1", "D2", "D3", "D5", "D6", "D7", "D8", "D9"] },
  { plant: "RG",     branches: ["RG"] },
];
const PLANT_OF_BRANCH = (() => {
  const m = new Map();
  PLANT_FAMILIES.forEach((f) => f.branches.forEach((b) => m.set(b, f.plant)));
  return m;
})();
/* The plant a branch rolls up to. A branch in no family stands on its own, so
   it still gets a sidebar group and its records stay reachable. */
const plantOfBranch = (code) => PLANT_OF_BRANCH.get(code) || code;
/* Every branch that rolls up to a plant, itself included. */
const branchesOfPlant = (plant) => {
  const f = PLANT_FAMILIES.find((x) => x.plant === plant);
  return f ? f.branches.slice() : [plant];
};

/* ---- Document series, one per plant ----
   Each plant runs its OWN Request No. series. It used to be a single
   portal-wide run, which made every plant's list look broken: the number was
   generated from every request in the portal, but a plant's screen only ever
   lists its own family, so numbers claimed by another plant simply went
   missing from view. Manila jumped 0022 -> 0035 because 0023..0034 belonged
   to Disney, and nothing on screen could explain the hole.

   Keyed on the PLANT and resolved through plantOfBranch, so a sub-branch
   files under its plant's series — a Hasbro request is Manila's, a D6 request
   is Disney's, exactly as the fund itself rolls up. A branch in no family
   falls back to its own code, which keeps its records numbered and unique
   rather than silently joining another plant's run.

   The generator (nextSeriesNo) still checks every candidate against EVERY
   number in the portal, so two plants can never mint the same string even
   though they now count independently.

   The same rule covers every numbered module, one run per MODULE x PLANT x
   YEAR:  PCR (request) · PCV (release voucher) · RMB (reimbursement) ·
   RPL (replenishment), e.g. PCR-M-2026-0001, RMB-RGC-2026-0004. In the
   cloud each number is ISSUED BY THE DATABASE and never reused, not even
   after a delete (supabase-series-guard.sql; issueSeriesNo in 19-app.jsx).

   The year is the year the number is ISSUED, not the transaction date, so a
   document number never changes because somebody corrected a date, and a
   backdated entry still joins the current run.

   A release voucher is not a series of its own: it carries its request's
   number (PCR-M-2026-0007 -> PCV-M-2026-0007) — see voucherNoForRequest —
   and its liquidation is filed under that voucher. One number follows the
   advance through Request -> Release Ledger -> Liquidation. */
const PLANT_SERIES_LETTER = { "A1+": "M", WARNER: "W", ST: "D", RG: "RGC" };
/* A branch outside the four plants numbers under its own code, reduced to
   letters and digits ("HAMFI(HO)" -> HAMFIHO) — the only characters the
   database accepts in a series prefix. Same rule as series_plant in
   supabase-renumber-series-per-plant.sql. */
const plantSeriesCode = (branchCode) => {
  const plant = plantOfBranch(branchCode);
  return PLANT_SERIES_LETTER[plant]
    || String(plant || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || "UNKNOWN";
};
const seriesPrefix = (tag, branchCode) =>
  tag + "-" + plantSeriesCode(branchCode) + "-" + new Date().getFullYear() + "-";
const requestNoPrefix = (branchCode) => seriesPrefix("PCR", branchCode);
const reimbNoPrefix = (branchCode) => seriesPrefix("RMB", branchCode);
const replenishmentNoPrefix = (branchCode) => seriesPrefix("RPL", branchCode);
/* The release voucher number for a request. A request number Accounting typed
   by hand (no PCR- tag) is still carried, just prefixed, so it stays unique. */
const voucherNoForRequest = (requestNo) => {
  const no = String(requestNo || "").trim();
  if (!no) return "";
  return /^PCR-/i.test(no) ? "PCV-" + no.slice(4) : "PCV-" + no;
};
/* Widen a branch grant to the full family of every plant it touches, so a
   partial grant cannot create a blind spot. */
const expandPlantFamilies = (codes) => {
  const out = [];
  (codes || []).forEach((c) => {
    branchesOfPlant(plantOfBranch(c)).forEach((b) => { if (out.indexOf(b) < 0) out.push(b); });
  });
  return out;
};
const resolvePlants = (plants) => ((plants === "ALL" || !plants)
  ? ALL_BRANCH_CODES.slice()
  : expandPlantFamilies(plants.filter((c) => BRANCH_CODE_SET.has(c))));

/* ---------------------------------------------------------------------------
   PETTY CASH REQUEST — approved Plant / Branch dropdown (Section 24)
   The New Petty Cash Request form must offer ONLY these configured values
   (no free-text entry). Administrators maintain this list here so it can be
   updated without touching the request form. Codes map to the BRANCHES master
   so the selection flows through approval, liquidation, replenishment and
   reporting unchanged.
--------------------------------------------------------------------------- */
const PCR_BRANCH_CODES = ["D1", "D2", "D3", "D5", "D6", "D7", "D8", "D9", "HASBRO", "SITIO", "MATTEL", "PERULANDIA", "WARNER", "A1+", "RG", "ST"];
const PCR_BRANCH_LABELS = {
  "A1+": "A1+ Multinational Packaging, Inc",
  "RG": "RG & Co. Property Management Corporation",
  "ST": "Starkson Packaging, Inc.",
};
const PCR_BRANCH_OPTIONS = PCR_BRANCH_CODES.map((code) => {
  const b = BRANCHES.find((x) => x.code === code);
  return { code, label: PCR_BRANCH_LABELS[code] || (b ? b.name : code) };
});

const SUBACCOUNTS = [
  {
    "code": "000-00000",
    "desc": "Default"
  },
  {
    "code": "000-00001",
    "desc": "General Management"
  },
  {
    "code": "000-00002",
    "desc": "Creatives"
  },
  {
    "code": "000-00003",
    "desc": "Sales and Accounts Management"
  },
  {
    "code": "000-00004",
    "desc": "Production"
  },
  {
    "code": "000-00005",
    "desc": "RM Warehouse and Logistics"
  },
  {
    "code": "000-00006",
    "desc": "FG Warehouse and Logistics"
  },
  {
    "code": "000-00007",
    "desc": "Engineering"
  },
  {
    "code": "000-00008",
    "desc": "Motorpool"
  },
  {
    "code": "000-00009",
    "desc": "Accounting and Finance"
  },
  {
    "code": "000-00010",
    "desc": "Human Resources"
  },
  {
    "code": "000-00011",
    "desc": "Information Technology"
  },
  {
    "code": "000-00012",
    "desc": "Procurement"
  },
  {
    "code": "000-00013",
    "desc": "PPIC"
  },
  {
    "code": "000-00014",
    "desc": "Special Projects"
  },
  {
    "code": "000-00015",
    "desc": "Quality Assurance"
  },
  {
    "code": "000-00016",
    "desc": "Research & Development"
  },
  {
    "code": "000-00017",
    "desc": "Business Development"
  },
  {
    "code": "000-00018",
    "desc": "Farm"
  },
  {
    "code": "000-00019",
    "desc": "China Accounts"
  },
  {
    "code": "000-00020",
    "desc": "China Human Resources & Admin"
  },
  {
    "code": "000-00021",
    "desc": "China Enginering"
  },
  {
    "code": "000-00022",
    "desc": "China Quality Assurance"
  },
  {
    "code": "000-00023",
    "desc": "China Hand Sample"
  },
  {
    "code": "000-00024",
    "desc": "China Supply Chain Department"
  },
  {
    "code": "000-00025",
    "desc": "China Accounting and Finance"
  },
  {
    "code": "000-00026",
    "desc": "China Creatives"
  },
  {
    "code": "000-00027",
    "desc": "China Logistics and Shipment"
  },
  {
    "code": "000-00028",
    "desc": "DISNEY 3 Manufacturing"
  },
  {
    "code": "000-0002D",
    "desc": "Warehouse/Logistics"
  },
  {
    "code": "000-00030",
    "desc": "Research & Development"
  },
  {
    "code": "000-00031",
    "desc": "Engineering"
  },
  {
    "code": "000-00032",
    "desc": "Procurement"
  },
  {
    "code": "000-00033",
    "desc": "DISNEY 6 Manufacturing"
  },
  {
    "code": "000-00034",
    "desc": "WARNER Manufacturing"
  },
  {
    "code": "000-00040",
    "desc": "SITIO Accounting & Finance"
  },
  {
    "code": "000-00041",
    "desc": "DISNEY 6 Accounting & Finance"
  },
  {
    "code": "000-00050",
    "desc": "WARNER IT"
  },
  {
    "code": "000-00051",
    "desc": "HASBRO IT"
  },
  {
    "code": "000-00052",
    "desc": "DISNEY 1 IT"
  },
  {
    "code": "000-00053",
    "desc": "DISNEY 5 IT"
  },
  {
    "code": "000-00060",
    "desc": "HASBRO Human Resources"
  },
  {
    "code": "000-00061",
    "desc": "DISNEY 1 Human Resources"
  },
  {
    "code": "000-00070",
    "desc": "Creatives"
  },
  {
    "code": "000-00080",
    "desc": "Special Projects"
  },
  {
    "code": "000-0014E",
    "desc": "PERULANDIA Engineering"
  },
  {
    "code": "000-0014Q",
    "desc": "PERULANDIA Quality Assurance"
  },
  {
    "code": "000-0016E",
    "desc": "DISNEY 3 Engineering"
  },
  {
    "code": "000-0016P",
    "desc": "DISNEY 3 PPIC"
  },
  {
    "code": "000-0016Q",
    "desc": "DISNEY 3 Quality Assurance"
  },
  {
    "code": "000-0017E",
    "desc": "DISNEY 5 Engineering"
  },
  {
    "code": "000-0017P",
    "desc": "DISNEY 5 PPIC"
  },
  {
    "code": "000-0017Q",
    "desc": "DISNEY 5 Quality Assurance"
  },
  {
    "code": "000-0017R",
    "desc": "DISNEY 5 Research & Development"
  },
  {
    "code": "000-0018E",
    "desc": "DISNEY 6 Engineering"
  },
  {
    "code": "000-0018P",
    "desc": "DISNEY 6 PPIC"
  },
  {
    "code": "000-0018Q",
    "desc": "DISNEY 6 Quality Assurance"
  },
  {
    "code": "000-0018R",
    "desc": "DISNEY 6 Research & Development"
  },
  {
    "code": "000-0019E",
    "desc": "DISNEY 8 Engineering"
  },
  {
    "code": "000-0019P",
    "desc": "DISNEY 8 PPIC"
  },
  {
    "code": "000-0019Q",
    "desc": "DISNEY 8 Quality Assurance"
  },
  {
    "code": "000-0019R",
    "desc": "DISNEY 8 Research & Development"
  },
  {
    "code": "000-0019W",
    "desc": "DISNEY 8 Warehouse/Logistics"
  },
  {
    "code": "000-0020",
    "desc": "HASBRO Mat Prep"
  },
  {
    "code": "000-0020E",
    "desc": "HASBRO Engineering"
  },
  {
    "code": "000-0020P",
    "desc": "HASBRO PPIC"
  },
  {
    "code": "000-0020Q",
    "desc": "HASBRO Quality Assurance"
  },
  {
    "code": "000-0020R",
    "desc": "HASBRO Research & Development"
  },
  {
    "code": "000-0020W",
    "desc": "HASBRO Warehouse/Logistics"
  },
  {
    "code": "000-0021E",
    "desc": "SITIO Engineering"
  },
  {
    "code": "000-0021P",
    "desc": "SITIO PPIC"
  },
  {
    "code": "000-0021Q",
    "desc": "SITIO Quality Assurance"
  },
  {
    "code": "000-0021R",
    "desc": "SITIO Research & Development"
  },
  {
    "code": "000-0021W",
    "desc": "SITIO Warehouse/Logistics"
  },
  {
    "code": "000-0022E",
    "desc": "MATTEL Engineering"
  },
  {
    "code": "000-0022P",
    "desc": "MATTEL PPIC"
  },
  {
    "code": "000-0022Q",
    "desc": "MATTEL Quality Assurance"
  },
  {
    "code": "000-0022R",
    "desc": "MATTEL Research & Development"
  },
  {
    "code": "000-0022W",
    "desc": "MATTEL Warehouse/Logistics"
  },
  {
    "code": "000-0023A",
    "desc": "DISNEY 1 Engineering"
  },
  {
    "code": "000-0023B",
    "desc": "DISNEY 1 PPIC"
  },
  {
    "code": "000-0023C",
    "desc": "DISNEY 1 Quality Assurance"
  },
  {
    "code": "000-0023D",
    "desc": "DISNEY 1 Research & Development"
  },
  {
    "code": "000-0023E",
    "desc": "DISNEY 1 Warehouse/Logistics"
  },
  {
    "code": "000-0024E",
    "desc": "DISNEY 2 Engineering"
  },
  {
    "code": "000-0024P",
    "desc": "DISNEY 2 PPIC"
  },
  {
    "code": "000-0024Q",
    "desc": "DISNEY 2 Quality Assurance"
  },
  {
    "code": "000-0024R",
    "desc": "DISNEY 2 Research & Development"
  },
  {
    "code": "000-0024W",
    "desc": "DISNEY 2 Warehouse/Logistics"
  },
  {
    "code": "000-0026E",
    "desc": "DISNEY 7 Engineering"
  },
  {
    "code": "000-0026P",
    "desc": "DISNEY 7 PPIC"
  },
  {
    "code": "000-0026Q",
    "desc": "DISNEY 7 Quality Assurance"
  },
  {
    "code": "000-0026R",
    "desc": "DISNEY 7 Research & Development"
  },
  {
    "code": "000-0026W",
    "desc": "DISNEY 7 Warehouse/Logistics"
  },
  {
    "code": "000-0027E",
    "desc": "HAMFI Engineering"
  },
  {
    "code": "000-0027P",
    "desc": "HAMFI PPIC"
  },
  {
    "code": "000-0027Q",
    "desc": "HAMFI Quality Assurance"
  },
  {
    "code": "000-0027R",
    "desc": "HAMFI Research & Development"
  },
  {
    "code": "000-0027S",
    "desc": "HAMFI Sales"
  },
  {
    "code": "000-0027W",
    "desc": "HAMFI Warehouse/Logistics"
  },
  {
    "code": "000-0028A",
    "desc": "WARNER Accounting"
  },
  {
    "code": "000-0028E",
    "desc": "WARNER Engineering"
  },
  {
    "code": "000-0028H",
    "desc": "WARNER Human Resources"
  },
  {
    "code": "000-0028P",
    "desc": "WARNER PPIC"
  },
  {
    "code": "000-0028Q",
    "desc": "WARNER Quality Assurance"
  },
  {
    "code": "000-0028R",
    "desc": "WARNER Research & Development"
  },
  {
    "code": "000-0028S",
    "desc": "WARNER Sales and Accounts Management"
  },
  {
    "code": "000-0028W",
    "desc": "WARNER Warehouse/Logistics"
  },
  {
    "code": "000-0040",
    "desc": ""
  },
  {
    "code": "000-FXD",
    "desc": ""
  },
  {
    "code": "001-00000",
    "desc": ""
  },
  {
    "code": "001-C0010",
    "desc": "China Accounts"
  },
  {
    "code": "001-C0020",
    "desc": "China Human Resources & Admin"
  },
  {
    "code": "001-C0030",
    "desc": "China Engineering"
  },
  {
    "code": "001-C0040",
    "desc": "China Quality Assurance"
  },
  {
    "code": "001-C0050",
    "desc": "China Handsample Team"
  },
  {
    "code": "001-C0060",
    "desc": "China Supply Chain Department"
  },
  {
    "code": "001-C0070",
    "desc": "China Accounting and Finance"
  },
  {
    "code": "001-C0080",
    "desc": "China Creatives"
  },
  {
    "code": "001-C0090",
    "desc": "China Logistics and Shipment"
  },
  {
    "code": "002-00000",
    "desc": ""
  },
  {
    "code": "002-FLEXF",
    "desc": "Flexible Films"
  },
  {
    "code": "002-FLEXP",
    "desc": "Flexible Packaging"
  },
  {
    "code": "002-PCKGE",
    "desc": "Packaging"
  },
  {
    "code": "002-PREMI",
    "desc": "Premium"
  },
  {
    "code": "003-00000",
    "desc": ""
  },
  {
    "code": "004-00000",
    "desc": ""
  },
  {
    "code": "641-0030",
    "desc": ""
  },
  {
    "code": "641-0150",
    "desc": ""
  },
  {
    "code": "641-0190",
    "desc": ""
  },
  {
    "code": "641-0340",
    "desc": ""
  },
  {
    "code": "CH -INA",
    "desc": ""
  },
  {
    "code": "CHI-NA",
    "desc": ""
  },
  {
    "code": "DEL-FIXED",
    "desc": "DELIVERY FIXED RATE"
  },
  {
    "code": "DIS-NEY",
    "desc": ""
  },
  {
    "code": "DIS-NEY 3",
    "desc": ""
  },
  {
    "code": "HAS-BRO",
    "desc": ""
  },
  {
    "code": "PER-U",
    "desc": ""
  },
  {
    "code": "SEC-AGEN",
    "desc": "Security Agency Payroll"
  },
  {
    "code": "TOP-MAN",
    "desc": ""
  },
  {
    "code": "TOP-MANA",
    "desc": ""
  },
  {
    "code": "WAR-NER",
    "desc": ""
  }
];

/* Tax categories mirror Acumatica's Tax Category master file. Used in the
   Liquidation worksheet and exported straight into the "Tax Category" column.

   Accounting narrowed the selectable list to the five petty-cash categories
   below (Sept 2026 master data update). Everything that was previously
   selectable lives on in TAX_CATEGORIES_LEGACY: it is no longer offered for new
   entries, but taxCategoryLabel() still resolves it so a historical liquidation
   keeps showing its real description instead of a bare code. */
const TAX_CATEGORIES = [
  { code: "VATEX", desc: "VAT – Exempt Goods" },
  { code: "VATEXSS", desc: "VAT – Exempt Services" },
  { code: "VATEXC", desc: "Vat Excluded" },
  { code: "VATGD", desc: "VAT – Vatable Goods" },
  { code: "VATSS", desc: "VAT – Vatable Services" },
];

const TAX_CATEGORIES_LEGACY = [
  { code: "CHN VAT8", desc: "CHN_VAT8%" },
  { code: "CHTX", desc: "CHINA TAXES" },
  { code: "LCBROKER", desc: "Landed Cost Brokerage - WC140" },
  { code: "LCBROKERVAT", desc: "Landed Cost Brokerage - WC140 and VAT" },
  { code: "LCMATERIAL", desc: "LANDED COST MATERIALS" },
  { code: "LCSHIPPING5WT", desc: "LANDED COST SHIPPPING - 5% WT AND VAT" },
  { code: "LCSTORAGE", desc: "Landed Cost Storage - VAT and WT" },
  { code: "LCTRUCKING", desc: "Landed Cost Trucking WC160" },
  { code: "LCVATEXSS", desc: "Landed Cost VAT – Exempt Services" },
  { code: "LCWHARFAGE", desc: "Landed Cost Wharfage/Arrastre WC160" },
  { code: "VATCE", desc: "VAT- Capital Goods Exceeding 1M" },
  { code: "VATIM", desc: "VAT – Importation" },
  { code: "VATNC", desc: "VAT- Capital Goods not Exceeding 1M" },
  { code: "VATSG", desc: "VAT – Sale to Government" },
  { code: "VATWH", desc: "VAT - Withholding Tax Holiday" },
  { code: "VATXX", desc: "VAT - Exempt Transaction" },
  { code: "VATZR", desc: "VAT – Zero Rated" },
  { code: "WC860", desc: "Income payment of manufacturers & direct importers of fuels" },
];

const taxCategoryLabel = (code) => {
  if (!code) return "—";
  const t = TAX_CATEGORIES.find((x) => x.code === code)
    || TAX_CATEGORIES_LEGACY.find((x) => x.code === code);
  return t ? `${t.code} — ${t.desc}` : code;
};

/* ============================= USER ROLES ============================= */

/* Each role only sees the nav tabs relevant to it. Plant-level data access is
   controlled separately (per user) so a custodian only sees their own plants. */
const ROLES = {
  "SuperAdmin": { label: "System Administrator", tabs: ["dashboard", "requests", "disbursements", "liquidation", "reimbursement", "replenishment", "history", "report", "approvals", "aging", "documents", "audit", "masterdata", "users", "settings"] },
  "Accounting": { label: "Accounting Department", tabs: ["dashboard", "requests", "disbursements", "liquidation", "reimbursement", "replenishment", "history", "report", "approvals", "aging", "documents", "audit", "masterdata", "users", "settings"] },
  "Finance":    { label: "Finance Department",    tabs: ["dashboard", "requests", "disbursements", "liquidation", "reimbursement", "replenishment", "history", "report", "approvals", "aging", "documents", "audit", "masterdata"] },
  /* Custodians are the first level of liquidation approval, so they get the
     Approval Module — scoped, like everything else, to their own plants. */
  "Custodian":  { label: "Custodian",             tabs: ["dashboard", "requests", "disbursements", "liquidation", "reimbursement", "replenishment", "history", "report", "approvals", "aging", "documents"] },
  /* PCF Requestor: prepares transactions only. Full Petty Cash Requests + full
     Liquidation (except approval) + Reimbursement (prepare/submit, no approval);
     Release Ledger is view-only. No Dashboard. No approve/reject/release rights
     (enforced by the permission flags in 19-app.jsx). No Report Center.
     Liquidation Aging (read-only, own plant) so they can see what is due. */
  "Requestor":  { label: "PCF Requestor",         tabs: ["requests", "disbursements", "liquidation", "reimbursement", "history", "aging"] },
};
const ROLE_NAMES = Object.keys(ROLES);

/* Decide a signed-in user's role, admin status and plant scope from the config
   in index.html (window.PCP_USERS). Accounting is the full super-admin. In
   local (no-auth) mode the operator is treated as Accounting super-admin so the
   tool stays fully usable offline. */
function resolveUserAccess(email) {
  if (!email) return { role: "Accounting", isAdmin: true, plants: "ALL", name: "Administrator" };
  const users = window.PCP_USERS || {};
  const admins = (window.PCP_ADMIN_EMAILS || []).map((s) => String(s).toLowerCase());
  const e = String(email).toLowerCase();
  const username = e.split("@")[0];
  const u = users[e] || users[username];
  if (u) {
    const role = ROLES[u.role] ? u.role : "Custodian";
    const isAdmin = role === "Accounting" || role === "SuperAdmin" || admins.includes(e) || admins.includes(username);
    return { role, isAdmin, plants: u.plants || "ALL", excludePlants: u.excludePlants || [], name: u.name || email };
  }
  if (admins.includes(e) || admins.includes(username)) return { role: "Accounting", isAdmin: true, plants: "ALL", name: email };
  const fb = (window.PCP_DEFAULT_ROLE && ROLES[window.PCP_DEFAULT_ROLE]) ? window.PCP_DEFAULT_ROLE : "Custodian";
  return { role: fb, isAdmin: false, plants: [], name: email };
}

/* Build the notification feed derived from current state — approvals awaiting
   action, overdue/pending liquidations, and completed replenishments. */
function buildNotifications(requests, disbursements, liquidations, replenishments) {
  const out = [];
  requests.forEach((r) => {
    if (r.status === "Pending") out.push({ id: "n-req-" + r.id, type: "approval", icon: "clip", title: "Approval required", text: `${r.requestNo} · ${r.employee} · ${peso(r.amount)}`, date: r.date });
    if (r.status === "Approved") out.push({ id: "n-appr-" + r.id, type: "approved", icon: "check", title: "Request approved — ready to release", text: `${r.requestNo} · ${r.employee}`, date: r.date });
    if (r.status === "Rejected") out.push({ id: "n-rej-" + r.id, type: "rejected", icon: "x", title: "Request rejected", text: `${r.requestNo} · ${r.employee}`, date: r.date });
  });
  disbursements.forEach((d) => {
    const status = liqStatusFor(d, liquidations);
    if (status === "Fully Liquidated" || status === "Over-Liquidated") return;
    const ageDays = Math.floor((Date.now() - new Date((d.date || todayISO()) + "T00:00:00").getTime()) / 86400000);
    const kind = d.transactionType || (d.isReimbursement ? "Reimbursement" : "Petty Cash");
    const who = `${d.voucherNo} · ${d.employee}`;
    if (ageDays >= 6)
      out.push({ id: "n-over-" + d.id, type: "overdue", icon: "alert", title: `${kind} liquidation overdue`, text: `${who} · ${ageDays} days outstanding — please liquidate now`, date: d.date });
    else if (ageDays === 5)
      out.push({ id: "n-due-" + d.id, type: "overdue", icon: "alert", title: `${kind} liquidation due today`, text: `${who} · due today (Day 5 of 5)`, date: d.date });
    else if (ageDays === 4)
      out.push({ id: "n-rem-" + d.id, type: "liquidation", icon: "sheet", title: `${kind} liquidation due tomorrow`, text: `${who} · reminder — liquidation is due tomorrow`, date: d.date });
    else
      out.push({ id: "n-liq-" + d.id, type: "liquidation", icon: "sheet", title: `${kind} liquidation pending`, text: `${who} · ${peso(d.amount)}`, date: d.date });
  });
  /* Receipts returned for correction — notify the requester to upload corrected
     documents before the liquidation can be resubmitted. */
  (liquidations || []).forEach((l) => {
    if (liqApprovalStatus(l) !== "For Revision") return;
    const d = disbursements.find((x) => x.id === l.disbursementId);
    if (!d) return;
    const rejected = (l.attachments || []).filter((a) => (a.approvalStatus || "Pending") === "Rejected").length;
    out.push({ id: "n-liqrev-" + l.id, type: "liquidation", icon: "alert", title: "Receipts returned for correction", text: `${d.voucherNo} · ${d.employee} · ${rejected} receipt(s) rejected — upload corrected documents`, date: d.date });
  });
  (replenishments || []).forEach((r) => {
    if (r.status === "Reverted") return;
    if (r.status === "Completed") out.push({ id: "n-rep-" + r.id, type: "replenished", icon: "refresh", title: "Replenishment completed", text: `${r.replenishmentNo} · ${peso(r.amount)}`, date: r.date });
    else out.push({ id: "n-repp-" + r.id, type: "replenish-pending", icon: "refresh", title: "Replenishment pending", text: `${r.replenishmentNo} · ${peso(r.amount)}`, date: r.date });
  });
  return out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

const EXPENSE_CATEGORIES = [
  "DL 13th month pay",
  "DL Contracted Support Services",
  "DL Employee's Benefit",
  "DL Govt Mandatory",
  "DL Retirement benefit",
  "DL Salaries and Wages",
  "DL Service Fee",
  "FOH - Indirect Salaries & Wages",
  "FOH - Manufacturing",
  "FOH Arrastre Fees",
  "FOH Brokerage Fees",
  "FOH Communication, Light & Water",
  "FOH Delivery Expense",
  "FOH Delivery Expense-Transpo",
  "FOH Demurrage",
  "FOH Depreciation - Bldg. Equipment",
  "FOH Depreciation - Building",
  "FOH Depreciation - Delivery Truck",
  "FOH Depreciation - Machineries",
  "FOH Depreciation - Motorcycle Services",
  "FOH Depreciation - Prod Equipment",
  "FOH Distribution Charge",
  "FOH Duties & Taxes",
  "FOH Freight In Charges",
  "FOH Handling Fees",
  "FOH Insurance",
  "FOH Licensing Fee",
  "FOH Miscellaneous",
  "FOH Oil & Gasoline",
  "FOH Other Charges",
  "FOH Production Tools",
  "FOH Rental",
  "FOH Rep & Main. - Bldg. Equipment",
  "FOH Rep & Main. - Building",
  "FOH Rep & Main. - Delivery Truck",
  "FOH Rep & Main. - Fire Truck",
  "FOH Rep & Main. - Inventory Discrepancy",
  "FOH Rep & Main. - Machineries",
  "FOH Rep & Main. - Motorcycle Services",
  "FOH Rep & Main. - Prod Equipment",
  "FOH Sec. Serv.-Agency Fee",
  "FOH Security services",
  "FOH Service Fee & Premium Bond",
  "FOH Storage Fees",
  "FOH Surcharges",
  "FOH Testing Fee",
  "FOH Toll Fee",
  "FOH Trucking",
  "FOH Wharfage Fee",
  "OE - Feeds",
  "OE 13th month pay",
  "OE Advertising and Promotion",
  "OE Audit Fee",
  "OE Bank Service Charges",
  "OE Commission Expense",
  "OE Communication, Light & Water",
  "OE Contracted Support Services",
  "OE Courier Services",
  "OE Depreciation - Building",
  "OE Depreciation - Company Car",
  "OE Depreciation - Furniture & Fixtures",
  "OE Depreciation - Land Improvement",
  "OE Depreciation - Office Equipment",
  "OE Depreciation - Residential & Leisure",
  "OE Depreciation - Software Licenses",
  "OE Documentary Stamp Tax",
  "OE Documentation, Registration",
  "OE Dues, Subscription and List",
  "OE Employee's Benefit",
  "OE Facilitation Fee",
  "OE Govt Mandatory",
  "OE Insurance",
  "OE Interest Expense",
  "OE Inventory Loss",
  "OE Inventory Obsolescence",
  "OE Janitorial Expense",
  "OE Legal fees",
  "OE Meal Allowance",
  "OE Miscellaneous",
  "OE OJT Allowance",
  "OE Office Supplies",
  "OE Oil & Gasoline",
  "OE Other Charges",
  "OE Penalties/Impounding/Towing Fees",
  "OE Printing, Supplies & Office",
  "OE Product Licensing/Patent Fee",
  "OE Professional Fees",
  "OE Provision for  Income Tax",
  "OE Rental",
  "OE Rep. & Main - Building",
  "OE Rep. & Main - Company Car",
  "OE Rep. & Main - Land Improvement",
  "OE Rep. & Main - Office Equipment",
  "OE Rep. & Main - Residential & Leisure",
  "OE Representation and Entertai",
  "OE Retirement Pay",
  "OE Salaries and wages",
  "OE Samples",
  "OE Scholar Allowance",
  "OE Scholar Tuition",
  "OE Security Services-Agency Fe",
  "OE Security services",
  "OE Seminars and Training Fee",
  "OE Separation Pay",
  "OE Service Fee",
  "OE Service and Other Charges",
  "OE Software Licenses",
  "OE Taxes and Licenses",
  "OE Testing Fee",
  "OE Toll Fee",
  "OE Transaction Loss",
  "OE Transportation and travel"
];

/* ============================= ALLOWABLE PURPOSES ============================= */
/* Predefined allowable business expenses for the PCF Request "Purpose" field.
   Free-text is not permitted except when "Others" is selected, which then
   requires a mandatory justification (captured in request.purposeJustification).
   The special OTHERS_PURPOSE value is treated as the "Others" option. */
const OTHERS_PURPOSE = "Others";
const ALLOWABLE_PURPOSES = [
  "FOH Communication, Light & Water",
  "FOH Delivery Expense",
  "FOH Delivery Expense-Transpo",
  "FOH Freight In Charges",
  "FOH Insurance",
  "FOH Miscellaneous",
  "FOH Oil & Gasoline",
  "FOH Other Charges",
  "FOH Production Tools",
  "FOH Rep & Main. - Bldg. Equipment",
  "FOH Rep & Main. - Building",
  "FOH Rep & Main. - Delivery Truck",
  "FOH Rep & Main. - Fire Truck",
  "FOH Rep & Main. - Inventory Discrepancy",
  "FOH Rep & Main. - Machineries",
  "FOH Rep & Main. - Motorcycle Services",
  "FOH Rep & Main. - Prod Equipment",
  "FOH Toll Fee",
  "FOH Trucking",
  "OE - Feeds",
  "OE Advertising and Promotion",
  "OE Bank Service Charges",
  "OE Commission Expense",
  "OE Communication, Light & Water",
  "OE Courier Services",
  "OE Documentary Stamp Tax",
  "OE Documentation, Registration",
  "OE Employee's Benefit",
  "OE Janitorial Expense",
  "OE Meal Allowance",
  "OE Miscellaneous",
  "OE Office Supplies",
  "OE Oil & Gasoline",
  "OE Other Charges",
  "OE Printing, Supplies & Office",
  "OE Rep. & Main - Building",
  "OE Rep. & Main - Company Car",
  "OE Rep. & Main - Land Improvement",
  "OE Rep. & Main - Office Equipment",
  "OE Rep. & Main - Residential & Leisure",
  "OE Representation and Entertainment",
  "OE Samples",
  "OE Seminars and Training Fee",
  "OE Taxes and Licenses",
  "OE Testing Fee",
  "OE Toll Fee",
  "OE Transportation and travel",
];

/* ============================= REIMBURSEMENT PURPOSE MASTER =============================
   Controlled Accounting master-data classification for the Reimbursement module.
   57 approved purposes: 25 FOH + 31 OE + "Others: Multiple Expenses". Purpose is
   treated as master data, NOT free text: an employee selects ONE ACTIVE value,
   the backend validates the selection, and the classification travels with the
   transaction through its whole PCF lifecycle.

   Never physically delete a purpose that a transaction has used — disable it
   (status !== "ACTIVE") instead. Only ACTIVE purposes are offered for new
   reimbursements; historical transactions always keep and display their
   original purpose even if it is later disabled. */
const REIMB_PURPOSE_MASTER = (() => {
  const foh = [
    "FOH Communication, Light & Water",
    "FOH Delivery Expense",
    "FOH Delivery Expense-Transpo",
    "FOH Demurrage",
    "FOH Distribution Charge",
    "FOH Duties & Taxes",
    "FOH Freight In Charges",
    "FOH Handling Fees",
    "FOH Insurance",
    "FOH Licensing Fee",
    "FOH Miscellaneous",
    "FOH Oil & Gasoline",
    "FOH Other Charges",
    "FOH Production Tools",
    "FOH Rental",
    "FOH Rep & Main. - Bldg. Equipment",
    "FOH Rep & Main. - Building",
    "FOH Rep & Main. - Delivery Truck",
    "FOH Rep & Main. - Fire Truck",
    "FOH Rep & Main. - Inventory Discrepancy",
    "FOH Rep & Main. - Machineries",
    "FOH Rep & Main. - Motorcycle Services",
    "FOH Rep & Main. - Prod Equipment",
    "FOH Testing Fee",
    "FOH Toll Fee",
  ];
  const oe = [
    "OE - Feeds",
    "OE Advertising and Promotion",
    "OE Communication, Light & Water",
    "OE Courier Services",
    "OE Documentary Stamp Tax",
    "OE Documentation, Registration",
    "OE Dues, Subscription and List",
    "OE Facilitation Fee",
    "OE Insurance",
    "OE Meal Allowance",
    "OE Miscellaneous",
    "OE Office Supplies",
    "OE Oil & Gasoline",
    "OE OJT Allowance",
    "OE Other Charges",
    "OE Printing, Supplies & Office",
    "OE Product Licensing/Patent Fee",
    "OE Professional Fees",
    "OE Rental",
    "OE Rep. & Main - Building",
    "OE Rep. & Main - Company Car",
    "OE Rep. & Main - Land Improvement",
    "OE Rep. & Main - Office Equipment",
    "OE Rep. & Main - Residential & Leisure",
    "OE Representation and Entertai",
    "OE Samples",
    "OE Seminars and Training Fee",
    "OE Taxes and Licenses",
    "OE Testing Fee",
    "OE Toll Fee",
    "OE Transportation and travel",
  ];
  /* A claim that bundles several unrelated expenses onto one request has no
     single FOH/OE purpose. Rather than force the employee to mis-classify it,
     this is an explicit choice — the real classification then lives on each
     expense line, where it belongs. */
  const other = [
    "Others: Multiple Expenses",
  ];
  const now = "2026-01-01T00:00:00";
  const build = (names, category) => names.map((name, i) => ({
    id: 0, code: category, name, category, status: "ACTIVE", created_at: now, updated_at: now,
  }));
  return build(foh, "FOH")
    .concat(build(oe, "OE"))
    .concat(build(other, "OTHER"))
    .map((p, i) => ({ ...p, id: i + 1 }));
})();

/* Fast lookup + derived views used by the dropdown, validation and reporting. */
const REIMB_PURPOSE_BY_NAME = REIMB_PURPOSE_MASTER.reduce((m, p) => { m[p.name] = p; return m; }, {});
const REIMB_PURPOSE_ACTIVE = REIMB_PURPOSE_MASTER.filter((p) => p.status === "ACTIVE");
const REIMB_PURPOSE_GROUPS = [
  { category: "FOH", label: "FOH EXPENSES", purposes: REIMB_PURPOSE_ACTIVE.filter((p) => p.category === "FOH") },
  { category: "OE", label: "OE EXPENSES", purposes: REIMB_PURPOSE_ACTIVE.filter((p) => p.category === "OE") },
  { category: "OTHER", label: "OTHER", purposes: REIMB_PURPOSE_ACTIVE.filter((p) => p.category === "OTHER") },
];
/* Category (FOH/OE) of a stored purpose name, "" when unknown/legacy. */
const purposeCategory = (name) => (REIMB_PURPOSE_BY_NAME[String(name || "").trim()] || {}).category || "";
/* Is this the name of a purpose that exists in the master at all? */
const isKnownReimbPurpose = (name) => !!REIMB_PURPOSE_BY_NAME[String(name || "").trim()];
/* May this purpose be chosen for a NEW reimbursement (exists AND ACTIVE)? */
const isActiveReimbPurpose = (name) => {
  const p = REIMB_PURPOSE_BY_NAME[String(name || "").trim()];
  return !!p && p.status === "ACTIVE";
};

const EXPENSE_CATEGORY_ACCOUNTS = {
  "DL 13th month pay": "51110120",
  "DL Contracted Support Services": "51110160",
  "DL Employee's Benefit": "51110130",
  "DL Govt Mandatory": "51110140",
  "DL Retirement benefit": "51110150",
  "DL Salaries and Wages": "51110110",
  "DL Service Fee": "51110165",
  "FOH Handling Fees": "52110050",
  "FOH - Indirect Salaries & Wages": "51110168",
  "FOH - Manufacturing": "51110169",
  "FOH Arrastre Fees": "52110060",
  "FOH Brokerage Fees": "52110030",
  "FOH Communication, Light & Water": "51110350",
  "FOH Delivery Expense": "51110420",
  "FOH Delivery Expense-Transpo": "51110400",
  "FOH Demurrage": "52110090",
  "FOH Depreciation - Bldg. Equipment": "51110260",
  "FOH Depreciation - Building": "51110250",
  "FOH Depreciation - Delivery Truck": "51110290",
  "FOH Depreciation - Machineries": "51110280",
  "FOH Depreciation - Motorcycle Services": "51110300",
  "FOH Depreciation - Prod Equipment": "51110270",
  "FOH Distribution Charge": "52110110",
  "FOH Duties & Taxes": "52110100",
  "FOH Freight In Charges": "52110020",
  "FOH Insurance": "51110320",
  "FOH Licensing Fee": "51110380",
  "FOH Miscellaneous": "51110390",
  "FOH Oil & Gasoline": "51110310",
  "FOH Other Charges": "52110130",
  "FOH Production Tools": "51110240",
  "FOH Rental": "51110360",
  "FOH Rep & Main. - Bldg. Equipment": "51110180",
  "FOH Rep & Main. - Building": "51110170",
  "FOH Rep & Main. - Delivery Truck": "51110210",
  "FOH Rep & Main. - Fire Truck": "51110220",
  "FOH Rep & Main. - Inventory Discrepancy": "51110231",
  "FOH Rep & Main. - Machineries": "51110200",
  "FOH Rep & Main. - Motorcycle Services": "51110230",
  "FOH Rep & Main. - Prod Equipment": "51110190",
  "FOH Sec. Serv.-Agency Fee": "51110340",
  "FOH Security services": "51110330",
  "FOH Service Fee & Premium Bond": "52110010",
  "FOH Storage Fees": "52110040",
  "FOH Surcharges": "52110070",
  "FOH Testing Fee": "51110370",
  "FOH Toll Fee": "51110315",
  "FOH Trucking": "52110080",
  "FOH Wharfage Fee": "52110120",
  "OE - Feeds": "64110553",
  "OE 13th month pay": "64110020",
  "OE Advertising and Promotion": "64110220",
  "OE Audit Fee": "64110300",
  "OE Bank Service Charges": "64110270",
  "OE Commission Expense": "64110090",
  "OE Communication, Light & Water": "64110180",
  "OE Contracted Support Services": "64110120",
  "OE Courier Services": "64110570",
  "OE Depreciation - Building": "64110440",
  "OE Depreciation - Company Car": "64110460",
  "OE Depreciation - Furniture & Fixtures": "64110480",
  "OE Depreciation - Land Improvement": "64110430",
  "OE Depreciation - Office Equipment": "64110470",
  "OE Depreciation - Residential & Leisure": "64110450",
  "OE Depreciation - Software Licenses": "64110485",
  "OE Documentary Stamp Tax": "64110585",
  "OE Documentation, Registration": "64110240",
  "OE Dues, Subscription and List": "64110230",
  "OE Employee's Benefit": "64110030",
  "OE Facilitation Fee": "64110310",
  "OE Govt Mandatory": "64110040",
  "OE Insurance": "64110330",
  "OE Interest Expense": "64110210",
  "OE Inventory Loss": "64110360",
  "OE Inventory Obsolescence": "64110350",
  "OE Janitorial Expense": "64110370",
  "OE Legal fees": "64110080",
  "OE Meal Allowance": "64110060",
  "OE Miscellaneous": "64110280",
  "OE Office Supplies": "64110140",
  "OE Oil & Gasoline": "64110170",
  "OE OJT Allowance": "64110015",
  "OE Other Charges": "64110340",
  "OE Penalties/Impounding/Towing Fees": "64110580",
  "OE Printing, Supplies & Office": "64110150",
  "OE Product Licensing/Patent Fee": "64110500",
  "OE Professional Fees": "64110070",
  "OE Provision for  Income Tax": "64110520",
  "OE Rental": "64110290",
  "OE Rep. & Main - Building": "64110390",
  "OE Rep. & Main - Company Car": "64110410",
  "OE Rep. & Main - Land Improvement": "64110380",
  "OE Rep. & Main - Office Equipment": "64110420",
  "OE Rep. & Main - Residential & Leisure": "64110400",
  "OE Representation and Entertai": "64110250",
  "OE Retirement Pay": "64110055",
  "OE Salaries and wages": "64110010",
  "OE Samples": "64110321",
  "OE Scholar Allowance": "64110551",
  "OE Scholar Tuition": "64110552",
  "OE Security services": "64110100",
  "OE Security Services-Agency Fe": "64110110",
  "OE Seminars and Training Fee": "64110260",
  "OE Separation Pay": "64110050",
  "OE Service and Other Charges": "64110510",
  "OE Service Fee": "64110130",
  "OE Software Licenses": "64110490",
  "OE Taxes and Licenses": "64110190",
  "OE Testing Fee": "64110320",
  "OE Toll Fee": "64110175",
  "OE Transaction Loss": "64110200",
  "OE Transportation and travel": "64110160",
};

function accountForCategory(category) {
  return EXPENSE_CATEGORY_ACCOUNTS[category] || "";
}


/* ---------------------------------------------------------------------------
   SEARCHABLE-DROPDOWN OPTION LISTS
   One source of truth for the option lists handed to <SearchSelect>, so the
   Petty Cash Request form, the Liquidation worksheet and the Reimbursement form
   all browse the same master data in the same shape.
--------------------------------------------------------------------------- */
const DEPARTMENT_CHOICES = SUBACCOUNTS.filter((s) => s.desc)
  .map((s) => ({ value: s.code, label: s.desc, hint: s.code }));

const EXPENSE_CATEGORY_CHOICES = EXPENSE_CATEGORIES
  .map((c) => ({ value: c, label: c, hint: accountForCategory(c) }));

/* Selectable tax categories only. A retired code already on a record still
   renders through taxCategoryLabel(), it is simply no longer offered. */
const TAX_CATEGORY_CHOICES = TAX_CATEGORIES
  .map((t) => ({ value: t.code, label: t.code, hint: t.desc }));


/* ---------------------------------------------------------------------------
   EXPENSE DEFINITION -> EXPENSE CATEGORY (master reference)
   Transcribed from "Expense Category for Portal.pdf". This is the approved
   list for Liquidation expense lines: the Expense Category picker offers only
   these, and the suggestion engine below can only ever return one of these.
   Category names are spelled exactly as they are in EXPENSE_CATEGORIES (and so
   in the Acumatica account map) — never rename one here, add it there first.

   `kw` are the words/phrases that point at the category, each with a weight:
     3 = on its own it identifies the category ("gasoline", "taxi")
     2 = a good hint that still shares meaning with another category
     1 = weak context only; never enough to auto-select by itself
   A keyword token of 5+ letters also matches longer words that start with it
   ("repair" -> "repairs", "print" -> "printer"); shorter ones match the word
   or its plural only. A trailing "=" forces that exact-word rule on a longer
   keyword ("train=" must not match "training").
   `not` switches the category off when any of those phrases is present.
   `repair: true` marks a Repair & Maintenance category: its `kw` are the
   OBJECTS being repaired, and they only count when a repair word is present.
--------------------------------------------------------------------------- */
const REPAIR_TERMS = [
  "repair", "maintenance", "maint", "fix", "fixed", "fixing", "servicing", "overhaul",
  "change oil", "tune up", "tuneup", "vulcaniz", "replacement", "replace", "spare part",
  "parts", "tire", "tyre", "battery", "brake", "repaint", "welding", "rewind",
  "troubleshoot", "upkeep", "reformat", "cleaning of", "car wash", "carwash",
];

/* Words that place an expense in factory overhead (FOH) rather than office /
   operating expense (OE), whatever department the line is charged to. */
const FOH_CUE_TERMS = [
  "foh", "delivery", "deliveries", "truck", "trucking", "forklift", "factory", "production",
  "machine", "machinery", "machineries", "warehouse", "shipment", "cargo", "container",
  "freight", "import", "customs", "generator", "genset", "boiler", "compressor", "extruder",
];
const OE_CUE_TERMS = ["office", "company car", "admin", "staff house", "client"];

/* Departments whose spend is factory overhead by default. */
const FOH_DEPARTMENT_TERMS = [
  "production", "manufactur", "warehouse", "logistics", "ppic", "engineering", "enginering",
  "quality assurance", "farm",
];

const CLW_KW = [
  ["electricity", 3], ["electric bill", 3], ["meralco", 3], ["power bill", 3], ["water bill", 3],
  ["maynilad", 3], ["manila water", 3], ["internet", 3], ["wifi", 3], ["telephone", 3], ["landline", 3],
  ["phone bill", 3], ["cellphone load", 3], ["mobile load", 3], ["prepaid load", 3], ["pldt", 3],
  ["converge", 3], ["globe", 2], ["utility", 3], ["utilities", 3], ["communication", 2],
  ["water", 1], ["light", 1], ["phone", 1], ["cellphone", 1], ["load", 1],
];
const CLW_NOT = ["mineral water", "drinking water", "bottled water", "purified water", "distilled water", "gallon", "water dispenser", "water analysis"];
const INSURANCE_KW = [["insurance", 3], ["insurance premium", 3], ["premium", 1], ["policy", 1]];
const MISC_KW = [["miscellaneous", 3], ["misc", 3], ["sundry", 2]];
const FUEL_KW = [
  ["gasoline", 3], ["gas", 3], ["diesel", 3], ["fuel", 3], ["petrol", 3], ["lubricant", 3],
  ["unleaded", 3], ["engine oil", 3], ["oil", 2], ["grease", 2], ["petron", 2], ["shell", 2],
  ["caltex", 2], ["seaoil", 2],
];
const OTHER_CHARGES_KW = [
  ["other charges", 3], ["surcharge", 2], ["service charge", 2], ["bank charge", 2],
  ["convenience fee", 2], ["penalty", 1], ["charge", 1],
];
const RENTAL_KW = [["rental", 3], ["rent", 3], ["lease", 3], ["leasing", 3], ["hire=", 1]];
const TESTING_KW = [
  ["testing", 3], ["test", 2], ["laboratory", 3], ["lab=", 2], ["calibration", 3], ["calibrate", 3],
  ["inspection", 3], ["analysis", 2], ["drug test", 3], ["water analysis", 3], ["certification", 2],
  ["microbial", 3],
];
const TOLL_KW = [
  ["toll", 3], ["tollgate", 3], ["expressway", 3], ["nlex", 3], ["slex", 3], ["skyway", 3],
  ["tplex", 3], ["cavitex", 3], ["calax", 3], ["autosweep", 3], ["easytrip", 3], ["rfid", 2],
  ["bridge fee", 2],
];
const BUILDING_OBJ = [
  ["building", 3], ["bldg", 3], ["roof", 3], ["roofing", 3], ["ceiling", 3], ["wall", 2],
  ["floor", 2], ["flooring", 3], ["door", 2], ["window", 2], ["toilet", 2], ["comfort room", 3],
  ["plumbing", 3], ["paint", 2], ["gate", 2], ["wiring", 2], ["electrical", 1], ["gutter", 3],
  ["facility", 2], ["facilities", 2],
];

const EXPENSE_DEFINITIONS = [
  { category: "FOH Communication, Light & Water", scope: "FOH", kw: CLW_KW, not: CLW_NOT,
    definition: "Operating costs for communication services, electricity, water, and similar utility services used for FOH operations." },
  { category: "FOH Delivery Expense", scope: "FOH",
    kw: [["delivery", 1], ["deliveries", 1], ["delivery helper", 3], ["pahinante", 3], ["delivery fee", 2], ["delivery charge", 2]],
    definition: "Expenses directly related to delivering or distributing goods, products, or materials for FOH operations, excluding transportation-specific charges." },
  { category: "FOH Delivery Expense-Transpo", scope: "FOH",
    kw: [["delivery trip", 5], ["delivery transpo", 5], ["delivery transportation", 5], ["vehicle hire", 3], ["truck hire", 3], ["hauling", 3], ["lalamove", 2], ["trucking", 2]],
    definition: "Transportation costs incurred for delivery activities, such as vehicle hire, delivery trips, or other delivery-related transport services." },
  { category: "FOH Demurrage", scope: "FOH",
    kw: [["demurrage", 3], ["detention", 3]],
    definition: "Charges incurred when cargo, containers, vehicles, or equipment are held beyond the allowed free time, resulting in waiting or detention fees." },
  { category: "FOH Distribution Charge", scope: "FOH",
    kw: [["distribution charge", 3], ["distribution", 2]],
    definition: "Fees charged for the distribution, handling, or movement of goods from a source to the intended destination." },
  { category: "FOH Duties & Taxes", scope: "FOH",
    kw: [["duties", 3], ["duty", 2], ["customs", 3], ["import tax", 3], ["import duties", 3], ["tariff", 3], ["vat on import", 3]],
    definition: "Government duties, customs charges, import taxes, and similar statutory charges related to FOH purchases or shipments." },
  { category: "FOH Freight In Charges", scope: "FOH",
    kw: [["freight", 3], ["forwarder", 3], ["forwarding", 2], ["shipping", 2], ["sea freight", 3], ["air freight", 3]],
    definition: "Freight or shipping costs incurred to bring purchased goods, materials, or supplies into the company or designated receiving location." },
  { category: "FOH Handling Fees", scope: "FOH",
    kw: [["handling", 3], ["unloading", 3], ["loading", 2], ["stevedoring", 3], ["arrastre", 2], ["sorting", 2]],
    definition: "Charges for loading, unloading, sorting, storage handling, or other physical handling of goods and materials." },
  { category: "FOH Insurance", scope: "FOH", kw: INSURANCE_KW,
    definition: "Insurance premiums or charges covering FOH assets, goods, shipments, or operational risks." },
  { category: "FOH Licensing Fee", scope: "FOH",
    kw: [["permit", 2], ["license", 2], ["licence", 2], ["licensing", 3], ["environmental permit", 3], ["ecc", 3], ["operating permit", 3], ["sanitary permit", 3], ["renewal", 1]],
    definition: "Fees paid to obtain or renew permits, licenses, registrations, or operating rights required for FOH activities." },
  { category: "FOH Miscellaneous", scope: "FOH", kw: MISC_KW,
    definition: "FOH operating expenses that are legitimate and necessary but do not reasonably fall under another available FOH expense category." },
  { category: "FOH Oil & Gasoline", scope: "FOH", kw: FUEL_KW,
    definition: "Fuel, gasoline, diesel, oil, lubricants, and similar petroleum products used for FOH vehicles or equipment." },
  { category: "FOH Other Charges", scope: "FOH", kw: OTHER_CHARGES_KW,
    definition: "FOH-related charges that are necessary for operations but do not specifically fit any other listed FOH expense category." },
  { category: "FOH Production Tools", scope: "FOH",
    kw: [["tool", 3], ["tools", 3], ["production tool", 3], ["hand tool", 3], ["implement", 2], ["screwdriver", 3], ["wrench", 3],
         ["pliers", 3], ["hammer", 3], ["cutter", 3], ["drill", 2], ["measuring tape", 3], ["tape measure", 3], ["blade", 2],
         ["knife", 2], ["jig", 3], ["mold", 2], ["mould", 2], ["die cut", 2], ["socket", 2], ["allen key", 3]],
    definition: "Purchase or use of small tools, implements, and production-related equipment used in FOH operations." },
  { category: "FOH Rental", scope: "FOH", kw: RENTAL_KW,
    definition: "Rental or lease costs for facilities, equipment, vehicles, or other assets used for FOH operations." },
  { category: "FOH Rep & Main. - Bldg. Equipment", scope: "FOH", repair: true,
    kw: [["pump", 3], ["generator", 3], ["genset", 3], ["aircon", 2], ["air conditioner", 2], ["elevator", 3], ["transformer", 3],
         ["water tank", 3], ["fire alarm", 3], ["cctv", 2], ["electrical panel", 3], ["exhaust fan", 2], ["lighting", 2], ["building equipment", 3]],
    definition: "Repair and maintenance costs for equipment installed in or used with FOH buildings or facilities, such as pumps, generators, or similar building equipment." },
  { category: "FOH Rep & Main. - Building", scope: "FOH", repair: true,
    kw: BUILDING_OBJ.concat([["warehouse", 2], ["factory", 2], ["plant", 1]]),
    definition: "Repair, maintenance, servicing, and minor upkeep costs for FOH buildings and facilities." },
  { category: "FOH Rep & Main. - Delivery Truck", scope: "FOH", repair: true, not: ["fire truck", "firetruck"],
    kw: [["truck", 3], ["delivery truck", 3], ["delivery van", 3], ["van", 2], ["delivery vehicle", 3]],
    definition: "Repair and maintenance costs for trucks used primarily for FOH delivery operations." },
  { category: "FOH Rep & Main. - Fire Truck", scope: "FOH", repair: true,
    kw: [["fire truck", 5], ["firetruck", 5], ["fire engine", 5], ["fire hose", 2], ["firefighting", 3]],
    definition: "Repair and maintenance costs for fire trucks and related firefighting vehicles." },
  { category: "FOH Rep & Main. - Inventory Discrepancy", scope: "FOH",
    kw: [["inventory discrepancy", 3], ["inventory shortage", 3], ["inventory variance", 3], ["discrepancy", 2], ["shortage", 2], ["variance", 2], ["stock count", 2]],
    definition: "Costs arising from approved inventory shortages, variances, or discrepancies identified during inventory reconciliation, when properly supported and authorized." },
  { category: "FOH Rep & Main. - Machineries", scope: "FOH", repair: true,
    kw: [["machine", 3], ["machinery", 3], ["machineries", 3], ["forklift", 3], ["extruder", 3], ["compressor", 3], ["boiler", 3],
         ["conveyor", 3], ["electric motor", 3], ["bearing", 2], ["belt", 2], ["gearbox", 3]],
    definition: "Repair, preventive maintenance, servicing, and minor parts or labor costs for FOH machinery." },
  { category: "FOH Rep & Main. - Motorcycle Services", scope: "FOH", repair: true,
    kw: [["motorcycle", 3], ["motorbike", 3], ["motor cycle", 3], ["scooter", 3], ["mc=", 2]],
    definition: "Repair, maintenance, servicing, and related operating upkeep for motorcycles used for FOH business activities." },
  { category: "FOH Rep & Main. - Prod Equipment", scope: "FOH", repair: true,
    kw: [["production equipment", 3], ["prod equipment", 3], ["sealer", 3], ["heat sealer", 3], ["weighing scale", 2], ["mixer", 2],
         ["dryer", 2], ["cutting equipment", 3], ["equipment", 1]],
    definition: "Repair and maintenance costs for production equipment used in FOH operations." },
  { category: "FOH Testing Fee", scope: "FOH", kw: TESTING_KW,
    definition: "Fees paid for testing, inspection, calibration, analysis, or certification required for FOH operations, products, or equipment." },
  { category: "FOH Toll Fee", scope: "FOH", kw: TOLL_KW,
    definition: "Toll road, expressway, bridge, or similar road-use charges incurred for authorized FOH business travel or delivery activities." },

  { category: "OE - Feeds", scope: "OE",
    kw: [["feeds", 3], ["feed", 3], ["animal feed", 3], ["fish feed", 3], ["chicken feed", 3], ["hog feed", 3], ["poultry", 2], ["livestock", 2]],
    definition: "Costs for animal feeds or other approved feed supplies required for company operations or business activities." },
  { category: "OE Advertising and Promotion", scope: "OE",
    kw: [["advertising", 3], ["advertisement", 3], ["ad=", 2], ["promotion", 3], ["promotional", 3], ["promo", 2], ["marketing", 3],
         ["publicity", 3], ["brochure", 3], ["flyer", 2], ["tarpaulin", 2], ["banner", 2], ["signage", 2], ["giveaway", 2],
         ["boosting", 3], ["facebook ads", 3], ["sponsorship", 2], ["trade show", 2]],
    definition: "Expenses for advertising, marketing, promotional campaigns, publicity materials, and related activities intended to promote the company, products, or services." },
  { category: "OE Communication, Light & Water", scope: "OE", kw: CLW_KW, not: CLW_NOT,
    definition: "Operating costs for telephone, internet, communication services, electricity, water, and similar office utilities." },
  { category: "OE Courier Services", scope: "OE",
    kw: [["courier", 3], ["lbc", 3], ["jrs", 3], ["jnt", 3], ["j t express", 3], ["2go", 3], ["air21", 3], ["ninja van", 3],
         ["grab express", 3], ["grabexpress", 3], ["lalamove", 2], ["postage", 3], ["parcel", 3], ["mail", 1], ["package", 1]],
    definition: "Fees paid to courier or delivery service providers for sending documents, packages, samples, or other business materials." },
  { category: "OE Documentary Stamp Tax", scope: "OE",
    kw: [["documentary stamp", 5], ["dst", 3], ["doc stamp", 5]],
    definition: "Documentary stamp taxes imposed by the government on documents, agreements, instruments, or transactions subject to DST." },
  { category: "OE Documentation, Registration", scope: "OE",
    kw: [["registration", 3], ["documentation", 3], ["notary", 3], ["notarial", 3], ["notarization", 3], ["certificate", 2],
         ["certified true copy", 3], ["nbi clearance", 3], ["police clearance", 3], ["psa", 3], ["sec registration", 3],
         ["dti", 3], ["lto", 3], ["authentication", 2], ["red ribbon", 3]],
    definition: "Fees for document processing, government or business registrations, certificates, permits, and related administrative documentation." },
  { category: "OE Dues, Subscription and List", scope: "OE",
    kw: [["dues", 3], ["subscription", 3], ["membership", 3], ["annual fee", 2], ["newspaper", 3], ["magazine", 3],
         ["publication", 2], ["directory", 2], ["mailing list", 3]],
    definition: "Membership dues, professional or business subscriptions, publications, directories, mailing lists, and similar recurring information-service fees." },
  { category: "OE Facilitation Fee", scope: "OE",
    kw: [["facilitation", 3], ["processing fee", 2], ["expedite", 2], ["liaison", 2]],
    definition: "Authorized fees paid to facilitate or process legitimate business transactions, applications, registrations, or services." },
  { category: "OE Insurance", scope: "OE", kw: INSURANCE_KW,
    definition: "Insurance premiums or charges covering company assets, employees, activities, vehicles, or other business-related risks." },
  { category: "OE Meal Allowance", scope: "OE",
    kw: [["meal", 3], ["meals", 3], ["lunch", 3], ["dinner", 3], ["breakfast", 3], ["merienda", 3], ["overtime meal", 3],
         ["food", 2], ["snack", 2], ["snacks", 2], ["jollibee", 2], ["mcdo", 2], ["mcdonald", 2], ["coffee", 1], ["rice", 1]],
    definition: "Authorized meal expenses or meal allowances incurred for employees during approved business activities, meetings, travel, or assignments." },
  { category: "OE Miscellaneous", scope: "OE", kw: MISC_KW,
    definition: "Legitimate and necessary operating expenses that do not reasonably fit any other available OE expense category." },
  { category: "OE Office Supplies", scope: "OE",
    kw: [["office supplies", 3], ["office supply", 3], ["paper", 3], ["bond paper", 3], ["pen", 3], ["ballpen", 3], ["ball pen", 3],
         ["sign pen", 3], ["pencil", 3], ["folder", 3], ["envelope", 3], ["stapler", 3], ["staple", 3], ["eraser", 3],
         ["stationery", 3], ["logbook", 3], ["record book", 3], ["paper clip", 3], ["sticky note", 3], ["post it", 3],
         ["marker", 2], ["clip", 2], ["glue", 2], ["notebook", 2], ["calculator", 2], ["tape", 1], ["office", 1]],
    definition: "Routine consumable supplies used for office and administrative work, such as paper, pens, folders, and similar items." },
  { category: "OE Oil & Gasoline", scope: "OE", kw: FUEL_KW,
    definition: "Fuel, gasoline, diesel, oil, lubricants, and similar petroleum products used for authorized company vehicles or equipment." },
  { category: "OE OJT Allowance", scope: "OE",
    kw: [["ojt", 3], ["on the job", 3], ["trainee", 3], ["intern=", 3], ["internship", 3]],
    definition: "Approved allowance or stipend provided to on-the-job trainees in accordance with company policy." },
  { category: "OE Other Charges", scope: "OE", kw: OTHER_CHARGES_KW,
    definition: "Necessary operating charges that are business-related but do not specifically fit any other available OE expense category." },
  { category: "OE Printing, Supplies & Office", scope: "OE",
    kw: [["print", 3], ["photocopy", 3], ["xerox", 3], ["reproduction", 3], ["ink", 3], ["toner", 3], ["cartridge", 3],
         ["laminat", 3], ["risograph", 3], ["binding", 2]],
    definition: "Printing, photocopying, reproduction, and other office-related consumables or supplies not classified under a more specific office-supplies category." },
  { category: "OE Product Licensing/Patent Fee", scope: "OE",
    kw: [["patent", 3], ["trademark", 3], ["intellectual property", 3], ["ipophl", 3], ["copyright", 3], ["product license", 3],
         ["product licensing", 3], ["product registration", 2]],
    definition: "Fees for product licenses, patents, intellectual property rights, registrations, renewals, or related legal rights." },
  { category: "OE Professional Fees", scope: "OE",
    kw: [["professional fee", 3], ["consultant", 3], ["consultancy", 3], ["consulting", 3], ["lawyer", 3], ["attorney", 3],
         ["legal", 2], ["accountant", 2], ["auditor", 2], ["audit", 2], ["architect", 2], ["talent fee", 2], ["speaker fee", 2]],
    definition: "Fees paid to qualified external professionals or consultants for specialized services, advice, or expertise." },
  { category: "OE Rental", scope: "OE", kw: RENTAL_KW,
    definition: "Rental or lease costs for offices, facilities, equipment, vehicles, or other assets used for business operations." },
  { category: "OE Rep. & Main - Building", scope: "OE", repair: true,
    kw: BUILDING_OBJ.concat([["office", 1]]),
    definition: "Repair, maintenance, servicing, and minor upkeep costs for company office or business buildings and facilities." },
  { category: "OE Rep. & Main - Company Car", scope: "OE", repair: true,
    kw: [["car", 3], ["company car", 3], ["service vehicle", 3], ["vehicle", 2], ["sedan", 3], ["suv", 3], ["pickup", 2], ["pick up", 2], ["auto", 1]],
    definition: "Repair, maintenance, servicing, and minor upkeep costs for company-owned or company-assigned cars." },
  { category: "OE Rep. & Main - Land Improvement", scope: "OE", repair: true,
    kw: [["land", 2], ["grounds", 3], ["landscaping", 3], ["landscape", 3], ["drainage", 3], ["grass", 2], ["grass cutting", 3],
         ["garden", 2], ["fence", 2], ["fencing", 2], ["pathway", 2], ["canal", 2], ["driveway", 2], ["parking lot", 2]],
    definition: "Costs for repair, maintenance, and minor improvements to company land, grounds, landscaping, drainage, or related site facilities." },
  { category: "OE Rep. & Main - Office Equipment", scope: "OE", repair: true,
    kw: [["printer", 3], ["computer", 3], ["pc=", 3], ["laptop", 3], ["desktop", 3], ["cpu", 3], ["monitor", 2], ["keyboard", 2],
         ["mouse", 2], ["photocopier", 3], ["copier", 3], ["scanner", 3], ["projector", 3], ["shredder", 3], ["office equipment", 3],
         ["aircon", 2], ["air conditioner", 2], ["ups", 2], ["fax", 2], ["telephone", 2]],
    definition: "Repair, maintenance, servicing, and minor upkeep costs for office equipment such as printers, computers, and similar equipment." },
  { category: "OE Rep. & Main - Residential & Leisure", scope: "OE", repair: true,
    kw: [["staff house", 3], ["staffhouse", 3], ["dormitory", 3], ["dorm", 3], ["barracks", 3], ["residential", 3], ["recreation", 3],
         ["leisure", 3], ["gym", 2], ["swimming pool", 3], ["pool", 2], ["clubhouse", 3], ["basketball court", 3]],
    definition: "Repair and maintenance costs for company-provided residential, recreational, or leisure facilities and related equipment." },
  { category: "OE Representation and Entertai", scope: "OE",
    kw: [["representation", 3], ["entertainment", 3], ["client meal", 3], ["client dinner", 3], ["client lunch", 3],
         ["client meeting", 3], ["client", 2], ["customer", 1], ["business partner", 2], ["visitor", 1], ["guest", 1]],
    definition: "Authorized business representation and entertainment expenses for clients, customers, business partners, or other external stakeholders." },
  { category: "OE Samples", scope: "OE",
    kw: [["sample", 3], ["hand sample", 3], ["prototype", 2], ["swatch", 2], ["mockup", 2], ["mock up", 2]],
    definition: "Costs for product or service samples used for customer presentations, evaluation, testing, demonstrations, or business development." },
  { category: "OE Seminars and Training Fee", scope: "OE",
    kw: [["seminar", 3], ["training", 3], ["workshop", 3], ["conference", 3], ["webinar", 3], ["course", 3], ["registration fee", 1]],
    definition: "Registration fees and related costs for approved seminars, conferences, workshops, courses, or employee training." },
  { category: "OE Taxes and Licenses", scope: "OE",
    kw: [["business permit", 3], ["mayor s permit", 3], ["mayors permit", 3], ["barangay clearance", 3], ["barangay permit", 3],
         ["community tax", 3], ["cedula", 3], ["tax", 2], ["taxes", 2], ["license", 2], ["licence", 2], ["permit", 2],
         ["government fee", 2], ["bir", 2]],
    definition: "Business taxes, government fees, permits, licenses, registrations, and similar statutory charges not classified under a more specific tax category." },
  { category: "OE Testing Fee", scope: "OE", kw: TESTING_KW,
    definition: "Fees for testing, inspection, laboratory analysis, calibration, certification, or other required evaluation of products, services, or equipment." },
  { category: "OE Toll Fee", scope: "OE", kw: TOLL_KW,
    definition: "Toll road, expressway, bridge, or similar road-use charges incurred during authorized company business travel." },
  { category: "OE Transportation and travel", scope: "OE", not: ["grab express", "grabexpress"],
    kw: [["transportation", 3], ["transpo", 3], ["travel", 3], ["taxi", 3], ["fare", 3], ["pamasahe", 3], ["grab", 3],
         ["grab car", 3], ["angkas", 3], ["uber", 3], ["jeep", 3], ["jeepney", 3], ["tricycle", 3], ["bus", 3], ["mrt", 3],
         ["lrt", 3], ["train=", 2], ["ferry", 3], ["boat", 2], ["parking", 3], ["airfare", 3], ["plane ticket", 3], ["flight", 3],
         ["hotel", 2], ["accommodation", 2], ["commute", 2], ["trip", 1]],
    definition: "Authorized business transportation and travel expenses, including fares, local transportation, parking, and other necessary travel-related costs." },
];

const APPROVED_EXPENSE_CATEGORY_SET = new Set(EXPENSE_DEFINITIONS.map((d) => d.category));
const isApprovedExpenseCategory = (c) => APPROVED_EXPENSE_CATEGORY_SET.has(c);

/* Picker options for a Liquidation expense line: the approved list only, in
   FOH / OE groups, each with its account code. */
const approvedCategoryChoice = (c) => ({ value: c, label: c, hint: accountForCategory(c) });
const APPROVED_EXPENSE_CATEGORY_GROUPS = ["FOH", "OE"].map((scope) => ({
  label: scope === "FOH" ? "FOH — Factory Overhead" : "OE — Operating Expense",
  options: EXPENSE_DEFINITIONS.filter((d) => d.scope === scope).map((d) => approvedCategoryChoice(d.category)),
}));

/* ---- Suggestion engine ---- */
const normalizeExpenseText = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* One keyword token against one word of the description. */
function expenseTokenMatches(kwTok, word, exactOnly) {
  if (word === kwTok || word === kwTok + "s" || word === kwTok + "es") return true;
  return !exactOnly && kwTok.length >= 5 && word.startsWith(kwTok);
}

/* Compile each keyword once: "hire=" -> { toks: ["hire"], exact: true }. */
function compileExpenseTerm(term) {
  const exact = term.endsWith("=");
  const clean = exact ? term.slice(0, -1) : term;
  return { term: clean, toks: normalizeExpenseText(clean).split(" "), exact };
}
/* The words of the description that matched (for "Detected: …"), or null. */
function expensePhraseIn(words, t) {
  for (let i = 0; i + t.toks.length <= words.length; i++) {
    if (t.toks.every((k, j) => expenseTokenMatches(k, words[i + j], t.exact))) return words.slice(i, i + t.toks.length).join(" ");
  }
  return null;
}
const expenseHits = (words, terms) => terms.map((t) => expensePhraseIn(words, t)).filter(Boolean);
const EXPENSE_MATCHERS = EXPENSE_DEFINITIONS.map((d) => ({
  ...d,
  kwC: d.kw.map(([term, w]) => ({ ...compileExpenseTerm(term), w })),
  notC: (d.not || []).map(compileExpenseTerm),
  /* FOH/OE twins ("FOH Rental" / "OE Rental", "FOH Rep & Main. - Building" /
     "OE Rep. & Main - Building") share this key. */
  pairKey: normalizeExpenseText(d.category.replace(/^(FOH|OE)\b/, "")),
}));
const EXPENSE_PAIR_KEYS = (() => {
  const seen = {};
  EXPENSE_MATCHERS.forEach((m) => { (seen[m.pairKey] = seen[m.pairKey] || new Set()).add(m.scope); });
  return new Set(Object.keys(seen).filter((k) => seen[k].size > 1));
})();
const REPAIR_MATCHERS = REPAIR_TERMS.map(compileExpenseTerm);
const FOH_CUE_MATCHERS = FOH_CUE_TERMS.map(compileExpenseTerm);
const OE_CUE_MATCHERS = OE_CUE_TERMS.map(compileExpenseTerm);

/* FOH or OE for a line: cue words in the description win, then the line's
   department, else OE. `source` says which one decided it. */
function expenseScopeFor(words, department) {
  const foh = expenseHits(words, FOH_CUE_MATCHERS);
  const oe = expenseHits(words, OE_CUE_MATCHERS);
  if (foh.length !== oe.length) {
    const fohWins = foh.length > oe.length;
    return { scope: fohWins ? "FOH" : "OE", source: "description", cues: fohWins ? foh : oe };
  }
  const dept = SUBACCOUNTS.find((s) => s.code === department);
  const desc = normalizeExpenseText(dept && dept.desc);
  if (desc && FOH_DEPARTMENT_TERMS.some((t) => desc.includes(t))) return { scope: "FOH", source: "department", cues: [] };
  return { scope: "OE", source: "department", cues: [] };
}

/* Rank the approved categories for an expense description.
   Returns { suggestions: [{ category, score, terms }], auto, scope, scopeSource, detected }.
   `auto` is set only for a clear winner: a top score of at least 2 that leads
   every other category (its own FOH/OE twin excepted) by 1.2 or more. A weak
   or tied description ("repair") leaves `auto` null and just lists options. */
function suggestExpenseCategories(text, { department } = {}) {
  const words = normalizeExpenseText(text).split(" ").filter(Boolean);
  if (!words.length) return { suggestions: [], auto: null, scope: null, scopeSource: null, detected: [] };
  const { scope, source, cues } = expenseScopeFor(words, department);
  const repairHits = expenseHits(words, REPAIR_MATCHERS);

  const scored = [];
  EXPENSE_MATCHERS.forEach((m) => {
    if (m.notC.some((t) => expensePhraseIn(words, t))) return;
    const hits = m.kwC.filter((t) => expensePhraseIn(words, t));
    let score = hits.reduce((s, t) => s + t.w, 0);
    let terms = expenseHits(words, hits);
    if (m.repair) {
      if (!repairHits.length) return;
      score = score ? 2 + score : 1;
      terms = repairHits.concat(terms);
    }
    if (!score) return;
    /* Out-of-scope categories stay listed but rank lower — a twin much lower. */
    if (m.scope !== scope) score *= EXPENSE_PAIR_KEYS.has(m.pairKey) ? 0.6 : 0.8;
    scored.push({ category: m.category, score: Math.round(score * 100) / 100, terms, pairKey: m.pairKey });
  });
  scored.sort((a, b) => b.score - a.score || a.category.localeCompare(b.category));

  const top = scored[0];
  let auto = null;
  if (top && top.score >= 2) {
    const rival = scored.find((s) => s !== top && s.pairKey !== top.pairKey);
    if (!rival || top.score - rival.score >= 1.2) auto = top.category;
  }
  /* The description's own words behind the leading suggestions, dropping any
     that sit inside a longer one ("electricity" inside "electricity bill"). */
  const hitWords = top
    ? Array.from(new Set(scored.filter((s) => s.score >= top.score - 1).flatMap((s) => s.terms).concat(cues)))
    : [];
  const detected = hitWords.filter((w) => !hitWords.some((x) => x !== w && (" " + x + " ").includes(" " + w + " ")));
  return {
    suggestions: scored.slice(0, 8).map(({ category, score, terms }) => ({ category, score, terms })),
    auto, scope, scopeSource: source, detected,
  };
}
