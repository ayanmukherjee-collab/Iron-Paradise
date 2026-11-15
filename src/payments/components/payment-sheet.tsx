"use client";

// The payment grid (brief §4.5). Rows arrive already computed from the
// ledger on the server; TanStack Table only sorts and searches them here.
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui/field";
import { formatPaise } from "@/lib/money";
import { StandingBadge } from "@/payments/components/standing-badge";
import { cellLabels, standingLabels } from "@/payments/describe";
import type { Standing } from "@/payments/ledger";
import type { SheetRow } from "@/payments/queries";
import type { CellStatus, MonthKey, SheetCell } from "@/payments/sheet";

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { text: sortFn_text, alphanumeric: sortFn_alphanumeric },
});

const helper = createColumnHelper<typeof features, SheetRow>();
const searchable = new Set(["fullName", "memberCode", "phone"]);
// The grid's markup is written by hand below; these columns only tell the
// table what it can sort by and search in.
const columns = helper.columns([
  helper.accessor("fullName", { sortFn: "text" }),
  helper.accessor("memberCode", { sortFn: "alphanumeric" }),
  helper.accessor("phone", { enableSorting: false }),
  helper.accessor("owedPaise", {}),
]);

type StandingFilter = Standing | "all" | "inactive";

const standingFilters: { key: StandingFilter; label: string }[] = [
  { key: "all", label: "Current" },
  { key: "overdue", label: standingLabels.overdue },
  { key: "due", label: standingLabels.due },
  { key: "paid", label: standingLabels.paid },
  { key: "free", label: standingLabels.free },
  { key: "inactive", label: "Inactive" },
];

function keepRow(row: SheetRow, filter: StandingFilter): boolean {
  if (filter === "inactive") return !row.isActive;
  if (!row.isActive) return false;
  return filter === "all" || row.standing === filter;
}

const cellStyles: Record<CellStatus, string> = {
  paid: "bg-white",
  partial: "bg-mist",
  due: "bg-ash text-white",
  overdue: "bg-ink text-white",
  upcoming: "bg-paper text-smoke",
  free: "bg-paper border-dashed",
  frozen: "bg-paper text-smoke",
  none: "bg-paper",
};

const monthHeading = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

// On a phone only a few months fit; open on the newest ones, where the
// money is still owed. Defined once so React calls it only on mount.
function scrollToNewest(node: HTMLDivElement | null) {
  if (node) node.scrollLeft = node.scrollWidth;
}

function monthLabel(month: MonthKey): string {
  return monthHeading.format(new Date(`${month}-01T00:00:00Z`));
}

export function PaymentSheet({
  rows,
  months,
}: {
  rows: SheetRow[];
  months: MonthKey[];
}) {
  const [filter, setFilter] = useState<StandingFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "fullName", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  // Stable between renders so the table keeps its row models.
  const data = useMemo(
    () => rows.filter((row) => keepRow(row, filter)),
    [rows, filter],
  );

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.memberId,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => searchable.has(column.id),
    enableSortingRemoval: false,
  });
  const shown = table.getRowModel().rows;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm font-semibold">
          <span className="sr-only">Search the sheet</span>
          <input
            type="search"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Name, phone or member ID"
            className={inputClass}
          />
        </label>
        <SortControl
          sorting={sorting}
          onChange={(id) => setSorting([{ id, desc: id === "owedPaise" }])}
        />
      </div>

      <div
        role="group"
        aria-label="Filter by payment standing"
        className="-mx-4 mt-4 [scrollbar-width:none] overflow-x-auto px-4"
      >
        <div className="flex gap-2">
          {standingFilters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`inline-flex min-h-10 items-center border-2 border-ink px-3 text-sm font-semibold whitespace-nowrap ${
                filter === key ? "bg-ink text-white" : "bg-white"
              }`}
            >
              {label} · {rows.filter((row) => keepRow(row, key)).length}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-lg">Nobody matches that.</p>
      ) : (
        <div
          ref={scrollToNewest}
          className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <table className="w-full min-w-max border-separate border-spacing-0 border-2 border-ink text-sm">
            <caption className="sr-only">
              Payments by member and month. Tap a month to record a payment.
            </caption>
            <thead>
              <tr className="bg-ink text-white">
                <th
                  scope="col"
                  className="sticky -left-4 z-10 bg-ink px-3 py-2 text-left sm:left-0"
                >
                  Member
                </th>
                {months.map((month) => (
                  <th key={month} scope="col" className="px-2 py-2 text-center">
                    {monthLabel(month)}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right">
                  Owes
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ original: row }) => (
                <tr key={row.memberId}>
                  <th
                    scope="row"
                    className="sticky -left-4 z-10 max-w-44 border-t-2 border-r-2 border-ink bg-white px-3 py-2 text-left font-normal sm:left-0"
                  >
                    <Link
                      href={`/app/members/${row.memberId}`}
                      className="block font-semibold underline-offset-4 hover:underline"
                    >
                      <span className="block truncate">{row.fullName}</span>
                      <span className="font-mono text-xs text-smoke">
                        {row.memberCode}
                      </span>
                    </Link>
                  </th>
                  {months.map((month) => (
                    <td
                      key={month}
                      className="border-t-2 border-l border-t-ink border-l-mist p-0 text-center"
                    >
                      <MonthCell
                        row={row}
                        month={month}
                        cell={row.cells[month]}
                      />
                    </td>
                  ))}
                  <td className="border-t-2 border-l-2 border-ink bg-white px-3 py-2 text-right whitespace-nowrap">
                    {row.owedPaise > 0 ? (
                      <strong>{formatPaise(row.owedPaise)}</strong>
                    ) : row.standing ? (
                      <StandingBadge standing={row.standing} />
                    ) : (
                      <span className="text-smoke">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-smoke">
        Showing {shown.length} of {data.length}. Amounts are measured against
        each member&apos;s own agreed fee.
      </p>
    </div>
  );
}

const sortOptions = [
  { id: "fullName", label: "Name" },
  { id: "memberCode", label: "Member ID" },
  { id: "owedPaise", label: "Most owed" },
];

function SortControl({
  sorting,
  onChange,
}: {
  sorting: SortingState;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold sm:w-48">
      Sort by
      <select
        value={sorting[0]?.id ?? "fullName"}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {sortOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MonthCell({
  row,
  month,
  cell,
}: {
  row: SheetRow;
  month: MonthKey;
  cell: SheetCell;
}) {
  if (cell.status === "none") return <span className="block min-h-12" />;

  const amount =
    cell.status === "partial"
      ? `${formatPaise(cell.paidPaise)}/${formatPaise(cell.feePaise)}`
      : cell.status === "free" || cell.status === "frozen"
        ? ""
        : formatPaise(cell.feePaise);
  const href = cell.target
    ? `/app/members/${row.memberId}/pay?period=${cell.target.period}`
    : `/app/members/${row.memberId}`;

  return (
    <Link
      href={href}
      aria-label={`${row.fullName}, ${monthLabel(month)}: ${cellLabels[cell.status]}${amount ? `, ${amount}` : ""}`}
      className={`flex min-h-12 min-w-20 flex-col items-center justify-center px-2 py-1 leading-tight hover:outline-2 hover:-outline-offset-2 hover:outline-ink ${cellStyles[cell.status]}`}
    >
      <span className="text-xs font-bold tracking-[0.06em] uppercase">
        {cellLabels[cell.status]}
      </span>
      {amount && <span className="text-xs">{amount}</span>}
    </Link>
  );
}
