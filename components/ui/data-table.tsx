"use client";

import { useMemo, useState } from "react";
import { ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export type ColumnDef<T> = {
  key: string;
  label: string;
  numeric?: boolean;
  center?: boolean;
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number;
  width?: number;
  render?: (row: T, idx: number) => ReactNode;
};

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  initialSort?: { key: string; dir: SortDir };
  activeRowId?: string | number;
  getRowId?: (row: T) => string | number;
  footer?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  initialSort,
  activeRowId,
  getRowId,
  footer,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>(
    initialSort ?? { key: null, dir: "asc" },
  );

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const accessor =
      col?.sortAccessor ??
      ((r: T) => (r as Record<string, unknown>)[sort.key!] as string | number);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "hu") * dir;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((s) => {
      if (s.key !== key) return { key, dir: "desc" };
      if (s.dir === "desc") return { key, dir: "asc" };
      return { key: null, dir: "asc" };
    });
  }

  return (
    <div className={cn("dt-shell", className)}>
      <div className="dt-scroll">
        <table className="dt-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSortable = col.sortable !== false;
                const sorted = sort.key === col.key ? sort.dir : undefined;
                return (
                  <th
                    key={col.key}
                    className="dt-th"
                    data-num={col.numeric || undefined}
                    data-center={col.center || undefined}
                    data-sortable={isSortable || undefined}
                    data-sorted={sorted}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => isSortable && toggleSort(col.key)}
                  >
                    <span className="dt-sort">
                      <span>{col.label}</span>
                      {isSortable && (
                        <ChevronUp
                          className="dt-sort-icon"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => {
              const id = getRowId ? getRowId(row) : idx;
              const isActive = activeRowId != null && id === activeRowId;
              return (
                <tr key={String(id)} data-active={isActive || undefined}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "dt-td",
                        col.numeric && "dt-num",
                        col.center && "text-center",
                      )}
                    >
                      {col.render
                        ? col.render(row, idx)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="dt-foot">{footer}</div>}
    </div>
  );
}
