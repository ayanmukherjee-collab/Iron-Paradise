"use client";

// The payments list (brief §4.5): one row per member with what they last
// paid, when, and when the next fee falls due. Anyone who owes money gets a
// black box with the amount, which opens the record-payment form. Rows
// arrive already computed from the ledger on the server; TanStack Table only
// sorts and searches them here.
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
import Link from "@/components/ui/link";
import { useMemo, useState } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { inputBase } from "@/components/ui/field";
import { Menu, MenuHeading, MenuOption } from "@/components/ui/menu";
import { formatShortDate, type IsoDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { standingLabels } from "@/payments/describe";
import type { Standing } from "@/payments/ledger";
import type { SheetRow } from "@/payments/queries";

/** A sheet row plus plain-text keys the table can sort dates by. */
type Row = SheetRow & { nextDueKey: string; lastPaidKey: string };

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { text: sortFn_text, alphanumeric: sortFn_alphanumeric },
});

const helper = createColumnHelper<typeof features, Row>();
const searchable = new Set(["fullName", "memberCode", "phone"]);
// The table's markup is written by hand below; these columns only tell the
// table what it can sort by and search in.
const columns = helper.columns([
  helper.accessor("fullName", { sortFn: "text" }),
  helper.accessor("memberCode", { sortFn: "alphanumeric" }),
  helper.accessor("phone", { enableSorting: false }),
  helper.accessor("owedPaise", {}),
  helper.accessor("nextDueKey", { sortFn: "text" }),
  helper.accessor("lastPaidKey", { sortFn: "text" }),
]);

const sortOptions: { id: string; label: string; desc: boolean }[] = [
  { id: "fullName", label: "Name, A to Z", desc: false },
  { id: "owedPaise", label: "Most owed", desc: true },
  { id: "nextDueKey", label: "Next due, soonest", desc: false },
  { id: "lastPaidKey", label: "Paid most recently", desc: true },
  { id: "memberCode", label: "Member ID", desc: false },
];

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

export function PaymentSheet({
  rows,
  today,
}: {
  rows: SheetRow[];
  today: IsoDate;
}) {
  const [filter, setFilter] = useState<StandingFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "fullName", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  // Stable between renders so the table keeps its row models. Members with
  // no date sort last either way.
  const data = useMemo<Row[]>(
    () =>
      rows
        .filter((row) => keepRow(row, filter))
        .map((row) => ({
          ...row,
          nextDueKey: row.nextDue ?? "9999-12-31",
          lastPaidKey: row.lastPayment?.paidOn ?? "0000-01-01",
        })),
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
  const sortedBy =
    sortOptions.find((option) => option.id === sorting[0]?.id) ??
    sortOptions[0];

  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <span className="sr-only">Search payments</span>
          <NavIconSvg
            icon="search"
            className="pointer-events-none absolute top-1/2 left-3.5 size-[1.1rem] -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Name, phone or ID"
            className={`${inputBase} pl-10`}
          />
        </label>
        <Menu label="Sort" icon="filter" badge={sortedBy.label}>
          {(close) => (
            <>
              <MenuHeading>Sort by</MenuHeading>
              {sortOptions.map((option) => (
                <MenuOption
                  key={option.id}
                  selected={option.id === sortedBy.id}
                  onSelect={() => {
                    setSorting([{ id: option.id, desc: option.desc }]);
                    close();
                  }}
                >
                  {option.label}
                </MenuOption>
              ))}
            </>
          )}
        </Menu>
      </div>

      <div
        role="group"
        aria-label="Filter by payment standing"
        className="-mx-4 mt-3 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <div className="flex gap-2">
          {standingFilters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className="chip"
            >
              {label}
              <span
                className={`tabular-nums ${filter === key ? "text-white/60" : "text-muted"}`}
              >
                {rows.filter((row) => keepRow(row, key)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-card bg-white p-6 text-center text-muted shadow-card">
          Nobody matches that.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-card bg-white shadow-card">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Each member&apos;s last payment and next due date. Amounts owed
              open the record-payment form.
            </caption>
            <thead>
              <tr className="text-left text-xs font-medium whitespace-nowrap text-muted">
                <th scope="col" className="py-3 pr-2 pl-4 sm:pl-6">
                  Member
                </th>
                <th scope="col" className="px-2 py-3 text-right">
                  Payment
                </th>
                <th scope="col" className="px-2 py-3">
                  Paid on
                </th>
                <th scope="col" className="py-3 pr-4 pl-2 sm:pr-6">
                  Next due
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ original: row }) => (
                <tr
                  key={row.memberId}
                  className="border-t border-line transition-colors hover:bg-canvas/40"
                >
                  <th
                    scope="row"
                    className="w-full max-w-0 py-3 pr-2 pl-4 text-left font-normal sm:pl-6"
                  >
                    <Link
                      href={`/app/members/${row.memberId}`}
                      className="block truncate font-semibold hover:underline hover:underline-offset-4"
                    >
                      {row.fullName}
                    </Link>
                    <span className="font-mono text-xs text-muted">
                      {row.memberCode}
                    </span>
                  </th>
                  <td className="px-2 py-3 text-right whitespace-nowrap">
                    <PaymentCell row={row} />
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-muted tabular-nums">
                    {row.lastPayment
                      ? formatShortDate(row.lastPayment.paidOn, today)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 pl-2 whitespace-nowrap tabular-nums sm:pr-6">
                    <NextDue row={row} today={today} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-muted">
        Showing {shown.length} of {data.length}. Tap an amount owed to record a
        payment.
      </p>
    </div>
  );
}

function PaymentCell({ row }: { row: Row }) {
  if (row.owedPaise > 0) {
    return (
      <Link
        href={`/app/members/${row.memberId}/pay`}
        aria-label={`${formatPaise(row.owedPaise)} owed by ${row.fullName}. Record a payment`}
        className="inline-flex flex-col items-end rounded-control bg-ink px-2.5 py-1.5 leading-tight text-white transition-colors hover:bg-graphite"
      >
        <span className="font-semibold tabular-nums">
          {formatPaise(row.owedPaise)}
        </span>
        <span className="text-[0.7rem] text-white/60">due</span>
      </Link>
    );
  }
  if (row.standing === "free") return <span className="text-muted">Free</span>;
  if (!row.lastPayment) return <span className="text-muted">—</span>;
  return (
    <span
      className={`font-medium tabular-nums ${row.isActive ? "" : "text-muted"}`}
    >
      {formatPaise(row.lastPayment.amountPaise)}
    </span>
  );
}

function NextDue({ row, today }: { row: Row; today: IsoDate }) {
  if (!row.nextDue) return <span className="text-muted">—</span>;
  const soon = row.standing === "due";
  return (
    <span className={soon ? "font-semibold" : ""}>
      {formatShortDate(row.nextDue, today)}
      {soon && (
        <span className="block text-[0.7rem] font-normal text-muted">
          Due soon
        </span>
      )}
    </span>
  );
}
