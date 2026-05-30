import { useState } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pageSize?: number;
  /** If provided, external pagination is used (server-side) */
  pageCount?: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
}

export function DataTable<TData>({
  columns,
  data,
  pageSize = 20,
  pageCount,
  onPageChange,
  currentPage = 0,
}: DataTableProps<TData>) {
  const [localPage, setLocalPage] = useState(0);

  const isServerPaginated = pageCount !== undefined && onPageChange !== undefined;
  const activePage = isServerPaginated ? currentPage : localPage;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
        pageIndex: isServerPaginated ? 0 : localPage,
      },
    },
    manualPagination: isServerPaginated,
    pageCount: isServerPaginated ? pageCount : undefined,
  });

  const handlePrev = () => {
    if (activePage > 0) {
      if (isServerPaginated) {
        onPageChange(activePage - 1);
      } else {
        setLocalPage((p) => p - 1);
        table.previousPage();
      }
    }
  };

  const handleNext = () => {
    const maxPage = isServerPaginated
      ? (pageCount ?? 1) - 1
      : table.getPageCount() - 1;
    if (activePage < maxPage) {
      if (isServerPaginated) {
        onPageChange(activePage + 1);
      } else {
        setLocalPage((p) => p + 1);
        table.nextPage();
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          Page {activePage + 1} of{' '}
          {isServerPaginated ? pageCount : table.getPageCount() || 1}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={activePage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={
              activePage >=
              (isServerPaginated ? (pageCount ?? 1) - 1 : table.getPageCount() - 1)
            }
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
