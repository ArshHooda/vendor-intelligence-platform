import {
  compactMoney,
  createElement,
  decimal,
  median,
  money,
  normalized,
  number,
  text,
  wholeNumber,
} from "./utils.js";

function summarize(vendors) {
  const totals = vendors.reduce(
    (result, vendor) => {
      result.spend += number(vendor.total_spend);
      result.bills += number(vendor.bill_count);
      result.openSpend += number(vendor.open_spend);
      result.holds += number(vendor.payment_hold_count);
      result.holdSpend += number(vendor.payment_hold_amount);
      result.largestBill = Math.max(result.largestBill, number(vendor.largest_bill_amount));
      return result;
    },
    { spend: 0, bills: 0, openSpend: 0, holds: 0, holdSpend: 0, largestBill: 0 },
  );
  totals.withPurchases = vendors.filter((vendor) => number(vendor.bill_count) > 0).length;
  totals.withoutPurchases = vendors.length - totals.withPurchases;
  const frequencies = vendors
    .filter((vendor) => number(vendor.bill_count) > 0)
    .map((vendor) => number(vendor.purchase_frequency_per_month));
  totals.averageFrequency = frequencies.length
    ? frequencies.reduce((sum, value) => sum + value, 0) / frequencies.length
    : 0;
  totals.medianGap = median(
    vendors.map((vendor) =>
      vendor.average_gap_days === null || vendor.average_gap_days === undefined
        ? Number.NaN
        : Number(vendor.average_gap_days),
    ),
  );
  return totals;
}

export function renderMetrics(vendors, state, elements, filtersActive) {
  const totals = summarize(vendors);
  const portfolioSpend = number(state.metadata.total_spend) || totals.spend;
  const portfolioShare = portfolioSpend ? (totals.spend / portfolioSpend) * 100 : 0;
  const openShare = totals.spend ? (totals.openSpend / totals.spend) * 100 : 0;

  elements.totalSpend.textContent = compactMoney.format(totals.spend);
  elements.totalSpend.title = money.format(totals.spend);
  elements.portfolioShare.textContent = `${portfolioShare.toFixed(1)}% of portfolio`;
  elements.totalBills.textContent = wholeNumber.format(totals.bills);
  elements.vendorsWithPurchases.textContent = `${wholeNumber.format(totals.withPurchases)} vendors with purchases`;
  elements.averageBill.textContent = money.format(totals.bills ? totals.spend / totals.bills : 0);
  elements.largestBill.textContent = `Largest bill ${compactMoney.format(totals.largestBill)}`;
  elements.openSpend.textContent = compactMoney.format(totals.openSpend);
  elements.openSpend.title = money.format(totals.openSpend);
  elements.openSpendShare.textContent = `${openShare.toFixed(1)}% of selected spend`;
  elements.averageFrequency.textContent = `${decimal.format(totals.averageFrequency)} / mo`;
  elements.medianGap.textContent = totals.medianGap === null
    ? "n.a."
    : `${decimal.format(totals.medianGap)} days`;
  elements.paymentHolds.textContent = wholeNumber.format(totals.holds);
  elements.paymentHoldSpend.textContent = `${money.format(totals.holdSpend)} on hold`;
  elements.noPurchaseVendors.textContent = wholeNumber.format(totals.withoutPurchases);
  elements.filteredVendorCount.textContent = wholeNumber.format(vendors.length);
  elements.filterResultText.textContent = `of ${wholeNumber.format(state.vendors.length)} vendors in the current view`;
  elements.resetFilters.disabled = !filtersActive;
}

export function renderSpenders(vendors, elements) {
  const limit = number(elements.topSpendersCount.value) || 3;
  const ranked = [...vendors]
    .filter((vendor) => number(vendor.total_spend) > 0)
    .sort((left, right) => number(right.total_spend) - number(left.total_spend))
    .slice(0, limit);
  const selectedSpend = vendors.reduce((sum, vendor) => sum + number(vendor.total_spend), 0);
  const maximum = ranked.length ? number(ranked[0].total_spend) : 0;

  elements.spenderList.replaceChildren();
  if (!ranked.length) {
    elements.spenderList.append(
      createElement("li", "loading-row", "No spend matches the current filters."),
    );
    return;
  }

  ranked.forEach((vendor, index) => {
    const item = createElement("li", "spender-item");
    const main = createElement("div", "spender-main");
    const valueRow = createElement("div", "spender-value-row");
    valueRow.append(
      createElement("strong", "", text(vendor.vendor_name, "Unknown vendor")),
      createElement("span", "", compactMoney.format(number(vendor.total_spend))),
    );
    const meta = createElement("div", "spender-meta");
    const share = selectedSpend ? (number(vendor.total_spend) / selectedSpend) * 100 : 0;
    meta.append(
      createElement("span", "", text(vendor.vendor_source_id)),
      createElement("span", "", `${wholeNumber.format(number(vendor.bill_count))} purchases · ${share.toFixed(1)}%`),
    );
    const track = createElement("div", "spender-track");
    const bar = createElement("span");
    bar.style.width = `${maximum ? (number(vendor.total_spend) / maximum) * 100 : 0}%`;
    track.append(bar);
    main.append(valueRow, meta, track);
    item.append(createElement("span", "spender-rank", String(index + 1)), main);
    elements.spenderList.append(item);
  });
}

export function renderSignals(vendors, elements) {
  const ranked = [...vendors].sort(
    (left, right) => number(right.total_spend) - number(left.total_spend),
  );
  const totalSpend = ranked.reduce((sum, vendor) => sum + number(vendor.total_spend), 0);
  const largest = ranked.find((vendor) => number(vendor.total_spend) > 0);
  const topThreeSpend = ranked
    .slice(0, 3)
    .reduce((sum, vendor) => sum + number(vendor.total_spend), 0);

  elements.largestVendorShare.textContent = `${largest && totalSpend
    ? ((number(largest.total_spend) / totalSpend) * 100).toFixed(1)
    : "0.0"}%`;
  elements.largestVendorName.textContent = largest
    ? text(largest.vendor_name)
    : "No vendor spend";
  elements.topThreeShare.textContent = `${totalSpend
    ? ((topThreeSpend / totalSpend) * 100).toFixed(1)
    : "0.0"}%`;
  elements.dormantVendors.textContent = wholeNumber.format(
    vendors.filter(
      (vendor) => number(vendor.bill_count) > 0 && number(vendor.days_since_last_purchase) > 365,
    ).length,
  );
  elements.flaggedVendors.textContent = wholeNumber.format(
    vendors.filter(
      (vendor) =>
        !["normal", "no purchase history"].includes(
          normalized(vendor.risk_label).toLowerCase(),
        ),
    ).length,
  );
}
