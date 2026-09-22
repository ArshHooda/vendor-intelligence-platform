import {
  createElement,
  decimal,
  formatCurrency,
  formatDate,
  money,
  normalized,
  number,
  statusChip,
  text,
  wholeNumber,
} from "./utils.js";

const PAGE_SIZE = 25;

function profileBadge(value, modifier = "") {
  return createElement("span", `profile-badge ${modifier}`.trim(), text(value));
}

function filterPurchases(purchases, elements, sortDirection) {
  const query = elements.purchaseSearch.value.trim().toUpperCase();
  const status = elements.purchaseStatusFilter.value;
  return purchases
    .filter((purchase) => !query || purchase.purchase_id.toUpperCase().includes(query))
    .filter((purchase) => status === "all" || normalized(purchase.status) === status)
    .sort((left, right) => {
      const comparison = String(left.purchase_date || "").localeCompare(
        String(right.purchase_date || ""),
      );
      return sortDirection === "asc" ? comparison : -comparison;
    });
}

function purchaseRow(purchase) {
  const row = document.createElement("tr");
  const referenceCell = createElement("td", "purchase-reference");
  referenceCell.append(createElement("code", "", purchase.purchase_id));

  const statusCell = document.createElement("td");
  statusCell.append(statusChip(purchase.status));

  const holdCell = document.createElement("td");
  holdCell.append(
    purchase.payment_hold
      ? statusChip(purchase.payment_hold_reason || "Payment hold")
      : createElement("span", "muted-value", "No"),
  );

  row.append(
    referenceCell,
    createElement("td", "", formatDate(purchase.purchase_date, "Unknown date")),
    statusCell,
    createElement(
      "td",
      "currency-cell",
      `${text(purchase.currency_code)} · ${text(purchase.currency)}`,
    ),
    createElement(
      "td",
      "money-cell",
      formatCurrency(purchase.original_amount, purchase.currency_code),
    ),
    createElement("td", "money-cell", formatCurrency(purchase.base_amount_usd, "USD")),
    holdCell,
  );
  return row;
}

export function createVendorDetailsController(elements) {
  const detailState = {
    vendors: [],
    vendorId: "",
    page: 1,
    sortDirection: "desc",
  };

  function currentVendor() {
    return detailState.vendors.find(
      (vendor) => vendor.vendor_source_id === detailState.vendorId,
    );
  }

  function populatePurchaseStatuses(vendor) {
    const previous = elements.purchaseStatusFilter.value;
    const statuses = [...new Set(vendor.purchases.map((purchase) => normalized(purchase.status)))]
      .sort((left, right) => left.localeCompare(right));
    elements.purchaseStatusFilter.replaceChildren(new Option("All statuses", "all"));
    statuses.forEach((status) => elements.purchaseStatusFilter.add(new Option(status, status)));
    elements.purchaseStatusFilter.value = statuses.includes(previous) ? previous : "all";
  }

  function renderProfile(vendor) {
    elements.detailVendorId.textContent = vendor.vendor_source_id;
    elements.detailVendorName.textContent = vendor.vendor_name;
    elements.detailVendorBadges.replaceChildren(
      profileBadge(vendor.vendor_status),
      profileBadge(vendor.vendor_approval_status),
      profileBadge(
        vendor.risk_label,
        normalized(vendor.risk_label).toLowerCase() === "normal" ? "profile-badge--normal" : "profile-badge--attention",
      ),
    );
    elements.detailTotalSpend.textContent = money.format(number(vendor.total_spend));
    elements.detailPurchaseCount.textContent = wholeNumber.format(number(vendor.bill_count));
    elements.detailAveragePurchase.textContent = money.format(number(vendor.average_bill_amount));
    elements.detailFirstPurchase.textContent = formatDate(vendor.first_purchase_date);
    elements.detailLastPurchase.textContent = formatDate(vendor.last_purchase_date);
    elements.detailAverageGap.textContent = vendor.average_gap_days === null || vendor.average_gap_days === undefined
      ? "n.a."
      : `${decimal.format(number(vendor.average_gap_days))} days`;
    elements.detailCountry.textContent = text(vendor.vendor_country);
    elements.detailMasterLastPaid.textContent = formatDate(
      vendor.master_last_paid_date,
      "Not available",
    );
  }

  function renderPurchases(vendor) {
    const purchases = filterPurchases(
      [...vendor.purchases],
      elements,
      detailState.sortDirection,
    );
    const pageCount = Math.max(1, Math.ceil(purchases.length / PAGE_SIZE));
    detailState.page = Math.min(detailState.page, pageCount);
    const start = (detailState.page - 1) * PAGE_SIZE;
    const visible = purchases.slice(start, start + PAGE_SIZE);
    elements.purchaseTableBody.replaceChildren();

    if (!visible.length) {
      const row = document.createElement("tr");
      const cell = createElement(
        "td",
        "empty-row",
        vendor.purchases.length
          ? "No purchases match these detail filters."
          : "This vendor has no purchase history.",
      );
      cell.colSpan = 7;
      row.append(cell);
      elements.purchaseTableBody.append(row);
    } else {
      visible.forEach((purchase) => elements.purchaseTableBody.append(purchaseRow(purchase)));
    }

    const shownStart = purchases.length ? start + 1 : 0;
    const shownEnd = Math.min(start + PAGE_SIZE, purchases.length);
    elements.purchasePageSummary.textContent = `Showing ${wholeNumber.format(shownStart)}–${wholeNumber.format(shownEnd)} of ${wholeNumber.format(purchases.length)} purchases · Page ${detailState.page} of ${pageCount}`;
    elements.previousPurchasePage.disabled = detailState.page <= 1;
    elements.nextPurchasePage.disabled = detailState.page >= pageCount;
  }

  function render() {
    const vendor = currentVendor();
    elements.vendorDetailEmpty.hidden = Boolean(vendor);
    elements.vendorDetailContent.hidden = !vendor;
    if (!vendor) return;
    renderProfile(vendor);
    renderPurchases(vendor);
  }

  function selectVendor(vendorId, { scroll = true } = {}) {
    if (!detailState.vendors.some((vendor) => vendor.vendor_source_id === vendorId)) return;
    detailState.vendorId = vendorId;
    detailState.page = 1;
    elements.detailVendorSelect.value = vendorId;
    elements.purchaseSearch.value = "";
    elements.purchaseStatusFilter.value = "all";
    const vendor = currentVendor();
    populatePurchaseStatuses(vendor);
    render();
    if (scroll) {
      elements.vendorDetailSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function setVendors(vendors) {
    detailState.vendors = [...vendors].sort((left, right) =>
      normalized(left.vendor_name).localeCompare(normalized(right.vendor_name)),
    );
    elements.detailVendorSelect.replaceChildren(new Option("Choose a vendor", ""));
    detailState.vendors.forEach((vendor) => {
      elements.detailVendorSelect.add(
        new Option(`${vendor.vendor_name} · ${vendor.vendor_source_id}`, vendor.vendor_source_id),
      );
    });
    const defaultVendor = [...vendors]
      .filter((vendor) => vendor.purchases.length)
      .sort((left, right) => number(right.total_spend) - number(left.total_spend))[0];
    if (defaultVendor) selectVendor(defaultVendor.vendor_source_id, { scroll: false });
  }

  elements.detailVendorSelect.addEventListener("change", () => {
    if (elements.detailVendorSelect.value) {
      selectVendor(elements.detailVendorSelect.value, { scroll: false });
    } else {
      detailState.vendorId = "";
      render();
    }
  });
  elements.purchaseSearch.addEventListener("input", () => {
    detailState.page = 1;
    render();
  });
  elements.purchaseStatusFilter.addEventListener("change", () => {
    detailState.page = 1;
    render();
  });
  elements.purchaseSortDirection.addEventListener("change", () => {
    detailState.sortDirection = elements.purchaseSortDirection.value;
    detailState.page = 1;
    render();
  });
  elements.previousPurchasePage.addEventListener("click", () => {
    if (detailState.page > 1) detailState.page -= 1;
    render();
  });
  elements.nextPurchasePage.addEventListener("click", () => {
    detailState.page += 1;
    render();
  });

  return { selectVendor, setVendors };
}
