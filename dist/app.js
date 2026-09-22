import { fetchDashboardData } from "./modules/data.js";
import { createDirectoryController } from "./modules/directory.js";
import {
  hasActiveFilters,
  populateFilters,
  resetFilters,
  selectedVendors,
} from "./modules/filters.js";
import { renderMetrics, renderSignals, renderSpenders } from "./modules/overview.js";
import { byId, formatDate, number, wholeNumber } from "./modules/utils.js";
import { createVendorDetailsController } from "./modules/vendor-details.js";

const ELEMENT_IDS = [
  "refreshButton", "statusDot", "statusText", "asOfDate", "errorBanner", "errorMessage",
  "vendorFilter", "paymentStatusFilter", "lastPurchaseFilter", "frequencyFilter", "gapFilter",
  "countryFilter", "vendorStatusFilter", "approvalFilter", "riskFilter", "resetFilters",
  "filteredVendorCount", "filterResultText", "totalSpend", "portfolioShare", "totalBills",
  "vendorsWithPurchases", "averageBill", "largestBill", "openSpend", "openSpendShare",
  "averageFrequency", "medianGap", "paymentHolds", "paymentHoldSpend", "noPurchaseVendors",
  "topSpendersCount", "spenderList", "largestVendorShare", "largestVendorName", "topThreeShare",
  "dormantVendors", "flaggedVendors", "sortBy", "sortDirection", "pageSize", "vendorTableBody",
  "pageSummary", "previousPage", "nextPage", "sourceNote", "vendorDetailSection",
  "detailVendorSelect", "vendorDetailEmpty", "vendorDetailContent", "detailVendorId",
  "detailVendorName", "detailVendorBadges", "detailTotalSpend", "detailPurchaseCount",
  "detailAveragePurchase", "detailFirstPurchase", "detailLastPurchase", "detailAverageGap",
  "detailCountry", "detailMasterLastPaid", "purchaseSearch", "purchaseStatusFilter",
  "purchaseSortDirection", "purchaseTableBody", "purchasePageSummary", "previousPurchasePage",
  "nextPurchasePage",
];

const elements = Object.fromEntries(ELEMENT_IDS.map((id) => [id, byId(id)]));
const filterElements = [
  elements.vendorFilter,
  elements.paymentStatusFilter,
  elements.lastPurchaseFilter,
  elements.frequencyFilter,
  elements.gapFilter,
  elements.countryFilter,
  elements.vendorStatusFilter,
  elements.approvalFilter,
  elements.riskFilter,
];

const state = {
  metadata: {},
  vendors: [],
  filtered: [],
  page: 1,
  pageSize: 50,
  sortBy: "total_spend",
  sortDirection: "desc",
};

const details = createVendorDetailsController(elements);
const directory = createDirectoryController(state, elements, (vendorId) => {
  details.selectVendor(vendorId);
});

function renderDashboard() {
  state.filtered = selectedVendors(state.vendors, elements);
  renderMetrics(state.filtered, state, elements, hasActiveFilters(elements));
  renderSpenders(state.filtered, elements);
  renderSignals(state.filtered, elements);
  directory.render();
}

function showError(message) {
  elements.errorBanner.hidden = false;
  elements.errorMessage.textContent = message;
}

function setLoading(loading) {
  elements.refreshButton.disabled = loading;
  elements.refreshButton.classList.toggle("is-loading", loading);
  if (loading) {
    elements.statusDot.className = "status-dot";
    elements.statusText.textContent = "Refreshing";
  }
}

async function loadDashboard() {
  setLoading(true);
  elements.errorBanner.hidden = true;
  try {
    const payload = await fetchDashboardData();
    state.metadata = payload.metadata || {};
    state.vendors = payload.vendors;
    state.page = 1;
    populateFilters(state.vendors, elements);
    details.setVendors(state.vendors);
    renderDashboard();
    elements.statusDot.className = "status-dot is-live";
    elements.statusText.textContent = "Secure activity snapshot";
    elements.asOfDate.textContent = state.metadata.as_of_date
      ? formatDate(state.metadata.as_of_date)
      : "Latest available";
    elements.sourceNote.textContent = `Snapshot built from ${wholeNumber.format(number(state.metadata.matched_bill_rows))} matched bills and ${wholeNumber.format(number(state.metadata.vendor_master_rows))} vendor records. ${wholeNumber.format(number(state.metadata.published_purchase_rows))} allow-listed purchase records are available; private source fields and original identifiers are excluded.`;
  } catch (error) {
    console.error("Dashboard data load failed", error);
    state.vendors = [];
    state.filtered = [];
    elements.statusDot.className = "status-dot is-offline";
    elements.statusText.textContent = "Data unavailable";
    showError(`${error.message}. Rebuild the validated dashboard snapshot and redeploy.`);
    renderMetrics([], state, elements, false);
    renderSpenders([], elements);
    renderSignals([], elements);
    directory.render();
  } finally {
    setLoading(false);
  }
}

filterElements.forEach((select) => {
  select.addEventListener("change", () => {
    state.page = 1;
    renderDashboard();
  });
});
elements.resetFilters.addEventListener("click", () => {
  resetFilters(elements);
  state.page = 1;
  renderDashboard();
});
elements.topSpendersCount.addEventListener("change", () => renderSpenders(state.filtered, elements));
elements.refreshButton.addEventListener("click", loadDashboard);

loadDashboard();
