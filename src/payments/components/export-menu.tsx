"use client";

import { Menu, MenuHeading, MenuLink } from "@/components/ui/menu";

/** Every download from the payments page, behind one Export button. */
export function ExportMenu() {
  return (
    <Menu label="Export" icon="download">
      {(close) => (
        <>
          <MenuHeading>Last 7 months</MenuHeading>
          <MenuLink
            href="/app/payments/export?format=xlsx"
            icon="payments"
            onSelect={close}
          >
            Excel file
          </MenuLink>
          <MenuLink
            href="/app/payments/export?format=csv"
            icon="audit"
            onSelect={close}
          >
            CSV file
          </MenuLink>
          <div className="my-1.5 border-t border-line" />
          <MenuHeading>All payments</MenuHeading>
          <MenuLink
            href="/app/payments/export?format=ledger"
            icon="clock"
            onSelect={close}
          >
            Payment log (CSV)
          </MenuLink>
        </>
      )}
    </Menu>
  );
}
