const SUPABASE_URL = "https://reejwrpxnckikgfefxtf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_YiJBi0gdgRpu9-Xhr_0pxg_hQRs9rha";

const API_PATHS = {
  summary: "/rest/v1/dashboard_summary?select=*",
  topVendors:
    "/rest/v1/top_vendor_concentration?select=*&order=total_spend.desc.nullslast&limit=10",
  risks:
    "/rest/v1/vendor_risk_summary?select=*&risk_label=neq.Normal&order=total_spend.desc.nullslast",
  holds: "/rest/v1/payment_hold_summary?select=*",
};

const VERIFIED_SNAPSHOT = {
  summary: [
    {
      total_bills: 13360,
      vendors_with_bills: 874,
      total_spend: 283563244.54,
      average_bill_amount: 21224.793752994012,
      largest_bill_amount: 4468780.5,
      payment_hold_bill_count: 23,
      payment_hold_spend: 94369.7,
    },
  ],
  topVendors: [
    ["VEN01556", "Syneos Health Clinical, Inc. (dba Syneos Health, LLC)", 210, 109451708.12, 38.6],
    ["VEN01576", "BAP Pharma Limited", 14, 15523319.24, 5.47],
    ["VEN00500", "Almac Clinical Services, LLC", 109, 10043229.61, 3.54],
    ["VEN01540", "Brammer Bio MA LLC", 84, 8505096.7, 3.0],
    ["VEN02247", "Euromed Pharma US, Inc.", 5, 7666279.58, 2.7],
    ["VEN00088", "EmeryStation Joint Venture, LLC", 44, 6299442.39, 2.22],
    ["VEN01555", "Gingko Bioworks, Inc.", 20, 5257614.78, 1.85],
    ["VEN00984", "Ora, Inc.", 19, 4539416.09, 1.6],
    ["VEN01241", "Everest Clinical Research Corporation", 106, 4040990.11, 1.43],
    ["VEN01006", "Rho, Inc.", 43, 3878820.99, 1.37],
  ].map(([vendor_source_id, vendor_name, bill_count, total_spend, spend_share_percent]) => ({
    vendor_source_id,
    vendor_name,
    bill_count,
    total_spend,
    spend_share_percent,
    vendor_status: "Active",
    vendor_approval_status: "Approved",
  })),
  risks: [
    {
      vendor_source_id: "VEN01556",
      vendor_name: "Syneos Health Clinical, Inc. (dba Syneos Health, LLC)",
      vendor_status: "Active",
      vendor_approval_status: "Approved",
      bill_count: 210,
      total_spend: 109451708.12,
      risk_label: "High concentration",
    },
    {
      vendor_source_id: "VEN01627",
      vendor_name: "The Leadership Edge, Inc.",
      vendor_status: "Active",
      vendor_approval_status: "Approved",
      bill_count: 3,
      total_spend: 160900,
      vendor_record_count: 2,
      risk_label: "Duplicate vendor record",
    },
    {
      vendor_source_id: "VEN02334",
      vendor_name: "Element Materials Technology Bend",
      vendor_status: "Active",
      vendor_approval_status: "Pending Approval",
      bill_count: 1,
      payment_hold_amount: 32630,
      risk_label: "Payment hold",
    },
  ],
  holds: [
    {
      payment_hold_reason: "Pending Vendor Approval",
      bill_count: 23,
      total_amount: 94369.7,
      earliest_bill_date: "2025-12-29",
      latest_bill_date: "2026-07-30",
    },
  ],
};

const elements = {
  refreshButton: document.querySelector("#refreshButton"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  updatedAt: document.querySelector("#updatedAt"),
  errorBanner: document.querySelector("#errorBanner"),
  errorMessage: document.querySelector("#errorMessage"),
  totalSpend: document.querySelector("#totalSpend"),
  totalBills: document.querySelector("#totalBills"),
  vendorsWithBills: document.querySelector("#vendorsWithBills"),
  paymentHolds: document.querySelector("#paymentHolds"),
  averageBill: document.querySelector("#averageBill"),
  largestBill: document.querySelector("#largestBill"),
  paymentHoldSpend: document.querySelector("#paymentHoldSpend"),
  topVendorShare: document.querySelector("#topVendorShare"),
  topVendorName: document.querySelector("#topVendorName"),
  topVendorSpend: document.querySelector("#topVendorSpend"),
  concentrationProgress: document.querySelector("#concentrationProgress"),
  concentrationBar: document.querySelector("#concentrationBar"),
  concentrationNote: document.querySelector("#concentrationNote"),
  holdCountChip: document.querySelector("#holdCountChip"),
  holdAmount: document.querySelector("#holdAmount"),
  holdReason: document.querySelector("#holdReason"),
  earliestHold: document.querySelector("#earliestHold"),
  latestHold: document.querySelector("#latestHold"),
  topVendorsBody: document.querySelector("#topVendorsBody"),
  riskQueueBody: document.querySelector("#riskQueueBody"),
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const wholeNumber = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function requestHeaders() {
  const headers = {
    Accept: "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY,
  };

  if (SUPABASE_PUBLISHABLE_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }

  return headers;
}

async function fetchView(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: requestHeaders(),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.message || body.hint || "";
    } catch {
      detail = "";
    }
    throw new Error(detail || `Supabase request failed (${response.status})`);
  }

  return response.json();
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? safeText(value) : dateFormatter.format(parsed);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function vendorCell(row) {
  const cell = createElement("td", "vendor-cell");
  cell.append(
    createElement("strong", "", safeText(row.vendor_name, "Unknown vendor")),
    createElement("span", "", safeText(row.vendor_source_id, "No vendor ID")),
  );
  return cell;
}

function renderSummary(rows) {
  const summary = rows[0];
  if (!summary) throw new Error("The dashboard summary view returned no rows.");

  elements.totalSpend.textContent = compactMoney.format(asNumber(summary.total_spend));
  elements.totalSpend.title = money.format(asNumber(summary.total_spend));
  elements.totalBills.textContent = wholeNumber.format(asNumber(summary.total_bills));
  elements.vendorsWithBills.textContent = wholeNumber.format(
    asNumber(summary.vendors_with_bills),
  );
  elements.paymentHolds.textContent = wholeNumber.format(
    asNumber(summary.payment_hold_bill_count),
  );
  elements.averageBill.textContent = `Average bill ${money.format(
    asNumber(summary.average_bill_amount),
  )}`;
  elements.largestBill.textContent = `Largest bill ${compactMoney.format(
    asNumber(summary.largest_bill_amount),
  )}`;
  elements.paymentHoldSpend.textContent = `${money.format(
    asNumber(summary.payment_hold_spend),
  )} on hold`;
}

function renderConcentration(rows) {
  const topVendor = rows[0];
  if (!topVendor) throw new Error("The vendor concentration view returned no rows.");

  const share = asNumber(topVendor.spend_share_percent);
  const topFiveShare = rows
    .slice(0, 5)
    .reduce((total, row) => total + asNumber(row.spend_share_percent), 0);

  elements.topVendorShare.textContent = `${share.toFixed(1)}%`;
  elements.topVendorName.textContent = safeText(topVendor.vendor_name);
  elements.topVendorSpend.textContent = money.format(asNumber(topVendor.total_spend));
  elements.concentrationProgress.setAttribute("aria-valuenow", String(share));
  elements.concentrationBar.style.width = `${Math.min(Math.max(share, 0), 100)}%`;
  elements.concentrationNote.textContent = `The five largest vendors represent ${topFiveShare.toFixed(
    1,
  )}% of total spend.`;

  elements.topVendorsBody.replaceChildren();
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.append(
      vendorCell(row),
      createElement("td", "", wholeNumber.format(asNumber(row.bill_count))),
      createElement("td", "money-cell", money.format(asNumber(row.total_spend))),
      createElement(
        "td",
        "share-cell",
        `${asNumber(row.spend_share_percent).toFixed(2)}%`,
      ),
    );
    elements.topVendorsBody.append(tr);
  });
}

function riskClass(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("concentration")) return "risk-chip risk-chip--high";
  if (normalized.includes("hold")) return "risk-chip risk-chip--medium";
  return "risk-chip risk-chip--neutral";
}

function renderRisks(rows) {
  elements.riskQueueBody.replaceChildren();

  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = createElement("td", "empty-row", "No active vendor risks were returned.");
    cell.colSpan = 5;
    row.append(cell);
    elements.riskQueueBody.append(row);
    return;
  }

  rows.forEach((item) => {
    const row = document.createElement("tr");
    const risk = document.createElement("td");
    risk.append(createElement("span", riskClass(item.risk_label), safeText(item.risk_label)));

    const status = createElement(
      "span",
      `status-label${String(item.vendor_status).toLowerCase() === "inactive" ? " is-inactive" : ""}`,
      safeText(item.vendor_approval_status, safeText(item.vendor_status)),
    );
    const statusCell = document.createElement("td");
    statusCell.append(status);

    const exposure = asNumber(item.payment_hold_amount) || asNumber(item.total_spend);
    row.append(
      risk,
      vendorCell(item),
      statusCell,
      createElement("td", "", wholeNumber.format(asNumber(item.bill_count))),
      createElement("td", "money-cell", money.format(exposure)),
    );
    elements.riskQueueBody.append(row);
  });
}

function renderHolds(rows) {
  const hold = rows[0];
  if (!hold) {
    elements.holdCountChip.textContent = "0 bills";
    elements.holdAmount.textContent = money.format(0);
    elements.holdReason.textContent = "No payment holds found";
    elements.earliestHold.textContent = "—";
    elements.latestHold.textContent = "—";
    return;
  }

  elements.holdCountChip.textContent = `${wholeNumber.format(asNumber(hold.bill_count))} bills`;
  elements.holdAmount.textContent = money.format(asNumber(hold.total_amount));
  elements.holdReason.textContent = safeText(hold.payment_hold_reason);
  elements.earliestHold.textContent = formatDate(hold.earliest_bill_date);
  elements.latestHold.textContent = formatDate(hold.latest_bill_date);
}

function renderDashboard(data) {
  renderSummary(data.summary);
  renderConcentration(data.topVendors);
  renderRisks(data.risks);
  renderHolds(data.holds);
}

function setLoading(isLoading) {
  elements.refreshButton.disabled = isLoading;
  elements.refreshButton.classList.toggle("is-loading", isLoading);
  if (isLoading) {
    elements.statusDot.className = "status-dot";
    elements.statusText.textContent = "Refreshing";
  }
}

async function loadDashboard() {
  setLoading(true);
  elements.errorBanner.hidden = true;

  try {
    const [summary, topVendors, risks, holds] = await Promise.all([
      fetchView(API_PATHS.summary),
      fetchView(API_PATHS.topVendors),
      fetchView(API_PATHS.risks),
      fetchView(API_PATHS.holds),
    ]);
    renderDashboard({ summary, topVendors, risks, holds });
    elements.statusDot.className = "status-dot is-live";
    elements.statusText.textContent = "Live data";
    elements.updatedAt.textContent = `Updated ${new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date())}`;
  } catch (error) {
    console.error("Dashboard data load failed", error);
    renderDashboard(VERIFIED_SNAPSHOT);
    elements.statusDot.className = "status-dot is-offline";
    elements.statusText.textContent = "Verified snapshot";
    elements.updatedAt.textContent = "Snapshot verified September 14, 2026";
    elements.errorBanner.hidden = false;
    elements.errorMessage.textContent = `${error.message} Showing the last verified snapshot.`;
  } finally {
    setLoading(false);
  }
}

elements.refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
