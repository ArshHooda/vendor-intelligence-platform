import {
  createElement,
  decimal,
  formatDate,
  money,
  normalized,
  number,
  statusChip,
  text,
  wholeNumber,
} from "./utils.js";

function compareRows(left, right, key, direction) {
  const leftValue = left[key];
  const rightValue = right[key];
  const leftMissing = leftValue === null || leftValue === undefined || leftValue === "";
  const rightMissing = rightValue === null || rightValue === undefined || rightValue === "";
  if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;

  let result;
  if (key.includes("date")) {
    result = new Date(leftValue).getTime() - new Date(rightValue).getTime();
  } else if (typeof leftValue === "number" || typeof rightValue === "number") {
    result = number(leftValue) - number(rightValue);
  } else {
    result = normalized(leftValue).localeCompare(normalized(rightValue), undefined, {
      sensitivity: "base",
    });
  }
  return direction === "asc" ? result : -result;
}

function vendorCell(vendor) {
  const cell = createElement("td", "vendor-cell");
  cell.append(
    createElement("strong", "", text(vendor.vendor_name, "Unknown vendor")),
    createElement("span", "", text(vendor.vendor_source_id, "No ID")),
  );
  return cell;
}

export function createDirectoryController(state, elements, onSelectVendor) {
  function render() {
    const sorted = [...state.filtered].sort((left, right) =>
      compareRows(left, right, state.sortBy, state.sortDirection),
    );
    const pageCount = Math.max(1, Math.ceil(sorted.length / state.pageSize));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * state.pageSize;
    const rows = sorted.slice(start, start + state.pageSize);
    elements.vendorTableBody.replaceChildren();

    if (!rows.length) {
      const row = document.createElement("tr");
      const cell = createElement("td", "empty-row", "No vendors match the current filters.");
      cell.colSpan = 9;
      row.append(cell);
      elements.vendorTableBody.append(row);
    } else {
      rows.forEach((vendor) => {
        const row = document.createElement("tr");
        const paymentCell = document.createElement("td");
        paymentCell.append(statusChip(vendor.payment_status));
        const actionCell = createElement("td", "action-cell");
        const action = createElement("button", "button button--ghost button--small", "View purchases");
        action.type = "button";
        action.addEventListener("click", () => onSelectVendor(vendor.vendor_source_id));
        actionCell.append(action);
        row.append(
          vendorCell(vendor),
          paymentCell,
          createElement("td", "", formatDate(vendor.last_purchase_date)),
          createElement("td", "number-cell", wholeNumber.format(number(vendor.bill_count))),
          createElement("td", "number-cell", `${decimal.format(number(vendor.purchase_frequency_per_month))} / mo`),
          createElement(
            "td",
            "number-cell",
            vendor.average_gap_days === null || vendor.average_gap_days === undefined
              ? "n.a."
              : `${decimal.format(number(vendor.average_gap_days))} days`,
          ),
          createElement(
            "td",
            "money-cell",
            vendor.average_bill_amount === null || vendor.average_bill_amount === undefined
              ? "—"
              : money.format(number(vendor.average_bill_amount)),
          ),
          createElement("td", "money-cell", money.format(number(vendor.total_spend))),
          actionCell,
        );
        elements.vendorTableBody.append(row);
      });
    }

    const shownStart = sorted.length ? start + 1 : 0;
    const shownEnd = Math.min(start + state.pageSize, sorted.length);
    elements.pageSummary.textContent = `Showing ${wholeNumber.format(shownStart)}–${wholeNumber.format(shownEnd)} of ${wholeNumber.format(sorted.length)} vendors · Page ${state.page} of ${pageCount}`;
    elements.previousPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= pageCount;
    document.querySelectorAll("th button[data-sort]").forEach((button) => {
      const active = button.dataset.sort === state.sortBy;
      button.classList.toggle("is-active", active);
      button.classList.toggle("is-ascending", active && state.sortDirection === "asc");
      button.setAttribute(
        "aria-sort",
        active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none",
      );
    });
  }

  elements.sortBy.addEventListener("change", () => {
    state.sortBy = elements.sortBy.value;
    state.page = 1;
    render();
  });
  elements.sortDirection.addEventListener("change", () => {
    state.sortDirection = elements.sortDirection.value;
    state.page = 1;
    render();
  });
  elements.pageSize.addEventListener("change", () => {
    state.pageSize = number(elements.pageSize.value);
    state.page = 1;
    render();
  });
  elements.previousPage.addEventListener("click", () => {
    if (state.page > 1) state.page -= 1;
    render();
  });
  elements.nextPage.addEventListener("click", () => {
    if (state.page * state.pageSize < state.filtered.length) state.page += 1;
    render();
  });
  document.querySelectorAll("th button[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (state.sortBy === key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortBy = key;
        state.sortDirection = key === "vendor_name" || key === "payment_status" ? "asc" : "desc";
      }
      elements.sortBy.value = state.sortBy;
      elements.sortDirection.value = state.sortDirection;
      state.page = 1;
      render();
    });
  });

  return { render };
}
