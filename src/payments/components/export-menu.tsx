"use client";

import { Menu, MenuHeading, MenuLink } from "@/components/ui/menu";

/** Every download from the payments page, behind one Export button. */
export function ExportMenu() {
  return (
    <Menu label="Export" icon="download">
      {(close) => (
        <>
          <MenuHeading>Payment sheet, last 7 months</MenuHeading>
          <MenuLink
            href="/app/payments/export?format=xlsx"
            icon="payments"
            detail="Also has every payment on a second tab"
            onSelect={close}
          >
            Excel file
          </MenuLink>
          <MenuLink
            href="/app/payments/export?format=csv"
            icon="audit"
            detail="Plain spreadsheet text"
            onSelect={close}
          >
            CSV file
          </MenuLink>
          <div className="my-1.5 border-t border-line" />
          <MenuHeading>Every payment ever recorded</MenuHeading>
          <MenuLink
            href="/app/payments/export?format=ledger"
            icon="clock"
            detail="One row per payment, voids marked"
            onSelect={close}
          >
            Full payment log (CSV)
          </MenuLink>
        </>
      )}
    </Menu>
  );
}
