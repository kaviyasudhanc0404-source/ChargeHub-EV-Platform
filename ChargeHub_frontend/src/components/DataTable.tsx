import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string; // e.g. "hidden md:table-cell" to hide on small screens
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: string;
}

const cellClass = "px-3 py-3.5 text-xs md:px-4 md:text-sm";

// Responsive table used across the admin and provider pages
function DataTable<T>({ columns, rows, rowKey, loading, empty = "Nothing to show yet" }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2 py-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/60" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    );
  }
  if (!rows.length) return <EmptyState icon={Inbox} title={empty} compact />;

  const [title, ...details] = columns;

  return (
    <>
      {/* Phones: one card per row, every column as a labelled line */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="space-y-2.5 rounded-xl border border-border/70 bg-background/40 p-4">
            <div className="text-sm">{title.cell(row)}</div>
            {details.map((col) => (
              <div key={col.header} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-xs text-muted-foreground">{col.header}</span>
                <div className="min-w-0 text-right">{col.cell(row)}</div>
              </div>
            ))}
          </li>
        ))}
      </ul>

    <div className="hidden overflow-x-auto md:block">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className={`${cellClass} border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:rounded-l-xl last:rounded-r-xl md:text-xs ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors hover:bg-primary/[0.04]">
              {columns.map((col) => (
                <td key={col.header} className={`${cellClass} border-b border-border/60 align-middle text-foreground ${col.className || ""}`}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export default DataTable;
