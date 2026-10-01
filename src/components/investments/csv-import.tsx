"use client";

import { useRef, useState, useMemo } from "react";
import { Upload, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import {
  buildTransactions,
  guessMapping,
  parseCsv,
  type CsvField,
  type CsvImportRow,
} from "@/lib/csv";
import type { CgtAssetKind } from "@/lib/types";

const FIELD_LABELS: { field: CsvField; label: string; hint?: string }[] = [
  { field: "date", label: "Date" },
  { field: "asset", label: "Asset / ticker" },
  { field: "side", label: "Buy or sell" },
  { field: "quantity", label: "Quantity" },
  { field: "unitPrice", label: "Price per unit", hint: "or map a total below" },
  { field: "total", label: "Total value", hint: "used when there's no unit price" },
  { field: "fee", label: "Fee", hint: "optional" },
];

const UNMAPPED = "__none__";

interface CsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CsvImport = ({ open, onOpenChange }: CsvImportProps) => {
  const { addCgtTransactions } = useTax();
  const action = useAsyncAction();
  const fileRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<CsvField, number>>>({});
  const [kind, setKind] = useState<CgtAssetKind>("crypto");
  const [fileName, setFileName] = useState("");
  const saving = action.busy;
  const [rowIds, setRowIds] = useState<string[]>([]);

  const reset = () => {
    action.clearError();
    setRowIds([]);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await action.run(async () => {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("Choose a CSV with a header and at least one trade.");
      setFileName(file.name);
      setHeaders(parsed[0]);
      setRows(parsed.slice(1));
      setRowIds(parsed.slice(1).map(() => crypto.randomUUID()));
      setMapping(guessMapping(parsed[0]));
    });
  };

  const preview: CsvImportRow[] = useMemo(() => rows.length
    ? buildTransactions(rows, mapping, kind).map((row, index) => row.transaction
      ? { ...row, transaction: { ...row.transaction, id: rowIds[index] } } : row)
    : [], [rows, mapping, kind, rowIds]);
  const valid = preview.filter((r) => r.transaction);
  const skipped = preview.filter((r) => !r.transaction);

  const handleImport = () => action.run(async () => {
    await addCgtTransactions(valid.map((r) => r.transaction!));
    reset();
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import trades from CSV</DialogTitle>
        </DialogHeader>

        {action.error && <p role="alert" className="text-sm text-destructive">{action.error} Retry to finish importing; already saved rows will be updated.</p>}
        {headers.length === 0 ? (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Export your transaction history from any exchange or broker and
              drop the file here. Column names differ everywhere, so you&apos;ll
              confirm which column is which before anything is saved.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              disabled={saving}
              className="hidden"
              id="cgt-csv"
            />
            <button
              disabled={saving}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-sm text-muted-foreground hover:border-gold/60"
            >
              <Upload className="h-5 w-5 text-gold" />
              Choose a CSV file
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[13px] text-muted-foreground">
                {fileName} · {rows.length} rows
              </p>
              <button
                disabled={saving}
                onClick={reset}
                className="text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Choose another file
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-kind">These are</Label>
              <Select disabled={saving} value={kind} onValueChange={(v) => setKind(v as CgtAssetKind)}>
                <SelectTrigger id="csv-kind">
                  <span>{kind === "crypto" ? "Crypto trades" : "Share trades"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crypto">Crypto trades</SelectItem>
                  <SelectItem value="share">Share trades</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {FIELD_LABELS.map(({ field, label, hint }) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`map-${field}`} className="text-xs">
                    {label}
                    {hint && (
                      <span className="ml-1 text-muted-foreground">({hint})</span>
                    )}
                  </Label>
                  <Select
                    disabled={saving}
                    value={mapping[field] === undefined ? UNMAPPED : String(mapping[field])}
                    onValueChange={(v) =>
                      setMapping((m) => ({
                        ...m,
                        [field]: v === UNMAPPED || v === null ? undefined : Number(v),
                      }))
                    }
                  >
                    <SelectTrigger id={`map-${field}`}>
                      <span className="truncate">
                        {mapping[field] === undefined
                          ? "Not mapped"
                          : headers[mapping[field]!]}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMAPPED}>Not mapped</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={`${h}-${i}`} value={String(i)}>
                          {h || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <div className="eyebrow mb-2">Preview — first 5 rows as read</div>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-[13px]">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-normal">Date</th>
                      <th className="px-3 py-2 text-left font-normal">Asset</th>
                      <th className="px-3 py-2 text-left font-normal">Side</th>
                      <th className="px-3 py-2 text-right font-normal">Qty</th>
                      <th className="px-3 py-2 text-right font-normal">Price</th>
                      <th className="px-3 py-2 text-right font-normal">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {row.transaction ? (
                          <>
                            <td className="px-3 py-2">{row.transaction.date}</td>
                            <td className="px-3 py-2">{row.transaction.asset}</td>
                            <td className="px-3 py-2 capitalize">{row.transaction.side}</td>
                            <td className="px-3 py-2 text-right tabular">
                              {row.transaction.quantity}
                            </td>
                            <td className="px-3 py-2 text-right tabular">
                              {formatCurrency(row.transaction.unitPrice)}
                            </td>
                            <td className="px-3 py-2 text-right tabular">
                              {formatCurrency(row.transaction.fee)}
                            </td>
                          </>
                        ) : (
                          <td colSpan={6} className="px-3 py-2 text-muted-foreground">
                            Skipped — {row.problem}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Dates that aren&apos;t ISO are read day-first (25/07/2026 is 25
                July). Check the preview before importing.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="text-[13px]">
                <span className="inline-flex items-center gap-1.5 text-positive">
                  <Check className="h-3.5 w-3.5" /> {valid.length} ready
                </span>
                {skipped.length > 0 && (
                  <span className="ml-3 inline-flex items-center gap-1.5 text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" /> {skipped.length}{" "}
                    skipped
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={saving} onClick={() => { reset(); onOpenChange(false); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={valid.length === 0 || saving}
                >
                  {saving ? "Importing…" : `Import ${valid.length} trades`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
