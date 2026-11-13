"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import Barcode from "react-barcode";
import { Download, ImagePlus, Loader2, Printer, Trash2 } from "lucide-react";
import {
  clearCardBackground,
  reserveCardPrintBatch,
  saveCardBackground,
  type CardPrintState,
} from "@/app/actions/card-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBarcode } from "@/lib/barcode";
import { CARD_HEIGHT_MM, CARD_WIDTH_MM, computeCardSheetLayout } from "@/lib/card-print-layout";
import { compressImageToJpeg, blobToBase64 } from "@/lib/image-compress";
import { formatDate } from "@/lib/utils";

const MAX_QTY = 200;

export function CardPrintStudio({ initial }: { initial: CardPrintState }) {
  const [state, setState] = useState(initial);
  const [quantity, setQuantity] = useState(10);
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [startNumber, setStartNumber] = useState(initial.nextCardSequence);
  const [previewReady, setPreviewReady] = useState(false);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    initial.backgroundUrl,
  );
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveStart = useCustomStart ? startNumber : state.nextCardSequence;
  const layout = useMemo(() => {
    const sheet = computeCardSheetLayout(Math.max(1, quantity || 1));
    return {
      ...sheet,
      cardLabel: `${CARD_WIDTH_MM}×${CARD_HEIGHT_MM} mm (ISO/IEC 7810 ID-1)`,
    };
  }, [quantity]);

  const previewCodes = useMemo(() => {
    const start = Number.isInteger(effectiveStart) && effectiveStart > 0 ? effectiveStart : 1;
    const qty = Math.min(Math.max(1, quantity || 1), layout.perPage);
    return Array.from({ length: qty }, (_, i) => formatBarcode(start + i));
  }, [effectiveStart, quantity, layout.perPage]);

  const firstCode = previewCodes[0] ?? formatBarcode(Math.max(1, effectiveStart || 1));
  const pages = layout.pages;
  const totalCards = Math.min(MAX_QTY, Math.max(0, quantity || 0));

  useEffect(() => {
    setPreviewReady(true);
  }, [previewCodes, backgroundPreview]);

  function refreshFromServer(next: CardPrintState) {
    setState(next);
    setStartNumber(next.nextCardSequence);
    setBackgroundPreview(next.backgroundUrl);
  }

  async function reloadState() {
    const { getCardPrintState } = await import("@/app/actions/card-print");
    refreshFromServer(await getCardPrintState());
  }

  function onChangeBackground(file: File | null) {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png)$/i.test(file.type)) {
      toast.error("Solo JPG o PNG.");
      return;
    }
    startTransition(async () => {
      try {
        const compressed = await compressImageToJpeg(file);
        const base64 = await blobToBase64(compressed.blob);
        const result = await saveCardBackground({
          base64,
          mimeType: compressed.mimeType,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setBackgroundPreview(compressed.dataUrl);
        toast.success("Fondo guardado.");
        await reloadState();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo subir el fondo.");
      }
    });
  }

  function onClearBackground() {
    startTransition(async () => {
      const result = await clearCardBackground();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBackgroundPreview(null);
      toast.success("Fondo eliminado.");
      await reloadState();
    });
  }

  async function onGeneratePdf() {
    if (!previewReady) {
      toast.error("Revisa la vista previa antes de generar el PDF.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      toast.error(`La cantidad debe ser entre 1 y ${MAX_QTY}.`);
      return;
    }
    if (useCustomStart && (!Number.isInteger(startNumber) || startNumber < 1)) {
      toast.error("El número inicial debe ser un entero positivo.");
      return;
    }

    setGenerating(true);
    try {
      const reserved = await reserveCardPrintBatch({
        quantity,
        startNumber: useCustomStart ? startNumber : null,
      });
      if (!reserved.ok) {
        toast.error(reserved.error);
        return;
      }

      const [{ buildCardBatchPdf }, { renderBarcodeDataUrl }] = await Promise.all([
        import("@/lib/card-print-pdf"),
        import("@/lib/card-barcode-canvas"),
      ]);
      const blob = await buildCardBatchPdf({
        codes: reserved.codes,
        backgroundDataUrl: backgroundPreview,
        renderBarcode: renderBarcodeDataUrl,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tarjetas-${reserved.fromCode}-${reserved.toCode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(
        `PDF listo: ${reserved.quantity} tarjetas (${reserved.fromCode} → ${reserved.toCode}).`,
      );
      await reloadState();
      setUseCustomStart(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el PDF.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-ink">
        Estas tarjetas se asignan al cliente al escanearlas en <strong>Alta</strong>. Generar el
        lote solo reserva los códigos; no crea clientes.
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5 rounded-xl border border-line bg-white p-5">
          <div>
            <h2 className="font-display text-xl font-semibold">Configurar lote</h2>
            <p className="mt-1 text-sm text-muted">
              Code 128 · formato <span className="font-mono text-brand">CRD-######</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad de tarjetas (1–{MAX_QTY})</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={MAX_QTY}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-line bg-page p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={useCustomStart}
                onChange={(e) => setUseCustomStart(e.target.checked)}
              />
              Usar número inicial personalizado
            </label>
            {useCustomStart ? (
              <div className="space-y-2">
                <Label htmlFor="start">Número inicial</Label>
                <Input
                  id="start"
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Number(e.target.value))}
                />
                <p className="font-mono text-xs text-brand">
                  {Number.isInteger(startNumber) && startNumber > 0
                    ? formatBarcode(startNumber)
                    : "—"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Continuar desde el último lote:{" "}
                <span className="font-mono font-semibold text-brand">{state.nextCode}</span>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Fondo / diseño</p>
                <p className="text-xs text-muted">JPG o PNG. Se usa en cada silueta.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Cambiar fondo
                </Button>
                {backgroundPreview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={onClearBackground}
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
              onChange={(e) => onChangeBackground(e.target.files?.[0] ?? null)}
            />
            {!backgroundPreview ? (
              <p className="text-xs text-muted">Sin fondo: silueta limpia con borde CREDICEL.</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-line bg-page px-3 py-2 text-xs text-muted">
            Layout A4: {layout.cols}×{layout.rows} = {layout.perPage} tarjetas/hoja · {pages} hoja
            {pages === 1 ? "" : "s"} · {totalCards} tarjeta{totalCards === 1 ? "" : "s"} ·{" "}
            {layout.cardLabel}
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={generating || pending || !previewReady || totalCards < 1}
            onClick={onGeneratePdf}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Generar PDF
          </Button>
          <p className="text-center text-xs text-muted">
            El PDF solo se descarga después de ver la vista previa.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold">Vista previa</h2>
              <p className="mt-1 text-sm text-muted">
                Primera hoja · {pages} hoja{pages === 1 ? "" : "s"} / {totalCards} tarjetas
              </p>
            </div>
            <Printer className="h-5 w-5 text-muted" />
          </div>

          <div className="overflow-auto rounded-xl border border-dashed border-line bg-[#EEF2F7] p-4">
            <div
              className="mx-auto grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                maxWidth: 420,
              }}
            >
              {previewCodes.map((code) => (
                <PreviewCard key={code} code={code} backgroundUrl={backgroundPreview} />
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-sm">
              <p className="mb-2 text-center text-xs uppercase tracking-[0.2em] text-muted">
                Tarjeta grande
              </p>
              <PreviewCard code={firstCode} backgroundUrl={backgroundPreview} large />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Historial de lotes</h2>
          <p className="text-sm text-muted">Fecha, rango y cantidad de los últimos lotes.</p>
        </div>
        {state.batches.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-4 py-6 text-sm text-muted">
            Aún no hay lotes generados.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Desde</th>
                  <th className="px-4 py-3 font-medium">Hasta</th>
                  <th className="px-4 py-3 font-medium">Cantidad</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {state.batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-muted">{formatDate(batch.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-brand">{batch.fromCode}</td>
                    <td className="px-4 py-3 font-mono text-xs text-brand">{batch.toCode}</td>
                    <td className="px-4 py-3">{batch.quantity}</td>
                    <td className="px-4 py-3 text-muted">{batch.createdByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PreviewCard({
  code,
  backgroundUrl,
  large,
}: {
  code: string;
  backgroundUrl: string | null;
  large?: boolean;
}) {
  return (
    <div
      className={
        large
          ? "relative aspect-[85.6/53.98] overflow-hidden rounded-xl border-2 border-brand/40 bg-white shadow-sm"
          : "relative aspect-[85.6/53.98] overflow-hidden rounded-lg border border-brand/30 bg-white shadow-sm"
      }
    >
      {backgroundUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 px-2 py-1">
        <Barcode
          value={code}
          format="CODE128"
          width={large ? 1.4 : 1}
          height={large ? 44 : 28}
          displayValue
          fontSize={large ? 12 : 9}
          margin={2}
          background="transparent"
        />
      </div>
    </div>
  );
}
