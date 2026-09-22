export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const wholeNumber = new Intl.NumberFormat("en-US");
export const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const currencyFormatters = new Map();

export function byId(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Required dashboard element is missing: ${id}`);
  return node;
}

export function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function text(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

export function normalized(value) {
  return text(value, "Not specified").trim();
}

export function formatDate(value, fallback = "No purchases") {
  if (!value) return fallback;
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? text(value) : dateFormatter.format(parsed);
}

export function formatCurrency(value, currencyCode) {
  const code = /^[A-Z]{3}$/.test(text(currencyCode, "")) ? currencyCode : null;
  if (!code) return `${decimal.format(number(value))} ${text(currencyCode, "")}`.trim();
  if (!currencyFormatters.has(code)) {
    currencyFormatters.set(
      code,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        maximumFractionDigits: 2,
      }),
    );
  }
  return currencyFormatters.get(code).format(number(value));
}

export function createElement(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function replaceOptions(select, placeholder, options) {
  const previous = select.value;
  select.replaceChildren(new Option(placeholder, "all"));
  options.forEach(({ value, label }) => select.add(new Option(label, value)));
  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

export function uniqueOptions(values) {
  return [...new Set(values.map(normalized))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
}

export function statusChip(status) {
  const value = text(status, "Not specified");
  const normalizedStatus = value.toLowerCase();
  let modifier = "status-chip--paid";
  if (normalizedStatus.includes("open") || normalizedStatus.includes("hold")) {
    modifier = "status-chip--open";
  } else if (normalizedStatus.includes("reject")) {
    modifier = "status-chip--rejected";
  } else if (
    normalizedStatus.includes("no purchase") ||
    normalizedStatus.includes("unavailable") ||
    normalizedStatus.includes("not specified")
  ) {
    modifier = "status-chip--none";
  }
  return createElement("span", `status-chip ${modifier}`, value);
}
