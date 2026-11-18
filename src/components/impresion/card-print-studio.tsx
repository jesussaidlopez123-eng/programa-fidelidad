"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import Barcode from "react-barcode";
import { Check, Download, ImagePlus, Loader2, Printer, Trash2, Upload } from "lucide-react";
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
import {
  CARD_DESIGN_PRESETS,
  CUSTOM_CARD_DESIGN_ID,
  isCardDesignPresetId,
  renderCardDesignDataUrl,
  type CardDesignPresetId,
} from "@/lib/card-designs";
import { CARDS_PER_PDF_FILE, MAX_CARD_BATCH } from "@/lib/card-print-limits";
import { CARD_HEIGHT_MM, CARD_WIDTH_MM, computeCardSheetLayout } from "@/lib/card-print-layout";
import { CREDICEL_LOGO_SRC } from "@/lib/credicel-logo";
import { compressImageToJpeg, blobToBase64 } from "@/lib/image-compress";
import { cn, formatDate } from "@/lib/utils";

const MAX_QTY = MAX_CARD_BATCH;

export function CardPrintStudio({ initial }: { initial: CardPrintState }) {
  const [state, setState] = useState(initial);
  const [quantity, setQuantity] = useState(10);
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [startNumber, setStartNumber] = useState(initial.nextCardSequence);
  const [previewReady, setPreviewReady] = useState(false);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    initial.backgroundUrl,
  );
  const [designId, setDesignId] = useState<string | null>(initial.designId);
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<string | null>(null);
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
  const isCustomSelected = designId === CUSTOM_CARD_DESIGN_ID && Boolean(backgroundPreview);

  useEffect(() => {
    setPreviewReady(true);
  }, [previewCodes, backgroundPreview]);

  function refreshFromServer(next: CardPrintState) {
    setState(next);
    setStartNumber(next.nextCardSequence);
    setBackgroundPreview(next.backgroundUrl);
    setDesignId(next.designId);
  }

  async function reloadState() {
    const { getCardPrintState } = await import("@/app/actions/card-print");
    refreshFromServer(await getCardPrintState());
  }

  function onSelectPreset(presetId: CardDesignPresetId) {
    if (pending || designId === presetId) return;
    startTransition(async () => {
      try {
        const rendered = await renderCardDesignDataUrl(presetId);
        const base64 = await blobToBase64(rendered.blob);
        const result = await saveCardBackground({
          base64,
          mimeType: rendered.mimeType,
          designId: presetId,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setBackgroundPreview(rendered.dataUrl);
        setDesignId(presetId);
        toast.success(`Diseño «${CARD_DESIGN_PRESETS.find((p) => p.id === presetId)?.label}» activo.`);
        await reloadState();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo aplicar el diseño.");
      }
    });
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
          designId: CUSTOM_CARD_DESIGN_ID,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setBackgroundPreview(compressed.dataUrl);
        setDesignId(CUSTOM_CARD_DESIGN_ID);
        toast.success("Mi diseño guardado.");
        await reloadState();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo subir el diseño.");
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
      setDesignId(null);
      toast.success("Diseño eliminado.");
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
    setGenerateProgress("Reservando códigos…");
    try {
      const reserved = await reserveCardPrintBatch({
        quantity,
        startNumber: useCustomStart ? startNumber : null,
      });
      if (!reserved.ok) {
        toast.error(reserved.error);
        return;
      }

      const [{ forEachCardBatchPdfChunk, downloadBlob }, { renderBarcodeDataUrl }] =
        await Promise.all([
          import("@/lib/card-print-pdf"),
          import("@/lib/card-barcode-canvas"),
        ]);

      let backgroundDataUrl = backgroundPreview;
      if (backgroundDataUrl && !backgroundDataUrl.startsWith("data:")) {
        setGenerateProgress("Cargando diseño…");
        const res = await fetch(backgroundDataUrl, { credentials: "same-origin" });
        if (!res.ok) throw new Error("No se pudo cargar el diseño de fondo.");
        const blobBg = await res.blob();
        backgroundDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("No se pudo leer el diseño."));
          reader.readAsDataURL(blobBg);
        });
      }

      setGenerateProgress(`Generando PDF 0/${reserved.quantity}…`);
      const { totalChunks } = await forEachCardBatchPdfChunk(
        {
          codes: reserved.codes,
          backgroundDataUrl,
          renderBarcode: renderBarcodeDataUrl,
          cardsPerFile: CARDS_PER_PDF_FILE,
          onProgress: (done, total) => {
            setGenerateProgress(`Generando PDF ${done}/${total}…`);
          },
        },
        async (chunk) => {
          const filename =
            chunk.totalChunks === 1
              ? `tarjetas-${reserved.fromCode}-${reserved.toCode}.pdf`
              : `tarjetas-${chunk.fromCode}-${chunk.toCode}-parte-${chunk.index}-de-${chunk.totalChunks}.pdf`;
          setGenerateProgress(
            chunk.totalChunks === 1
              ? "Descargando PDF…"
              : `Descargando parte ${chunk.index} de ${chunk.totalChunks}…`,
          );
          // Pequeña pausa entre descargas para que el navegador no bloquee archivos.
          await downloadBlob(chunk.blob, filename, chunk.index === 1 ? 0 : 450);
        },
      );

      toast.success(
        totalChunks === 1
          ? `PDF listo: ${reserved.quantity} tarjetas (${reserved.fromCode} → ${reserved.toCode}).`
          : `Listo: ${reserved.quantity} tarjetas en ${totalChunks} PDFs (${reserved.fromCode} → ${reserved.toCode}).`,
      );
      await reloadState();
      setUseCustomStart(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el PDF.");
    } finally {
      setGenerating(false);
      setGenerateProgress(null);
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
                <p className="text-sm font-semibold">Diseños</p>
                <p className="text-xs text-muted">
                  Elige un diseño CREDICEL o carga el tuyo (JPG/PNG).
                </p>
              </div>
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CARD_DESIGN_PRESETS.map((preset) => {
                const selected = designId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={pending}
                    onClick={() => onSelectPreset(preset.id)}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                      selected
                        ? "border-brand ring-2 ring-brand/35"
                        : "border-line hover:border-brand/40",
                    )}
                    aria-pressed={selected}
                  >
                    <div
                      className="relative aspect-[85.6/53.98] w-full"
                      style={{ background: preset.cssBackground }}
                    >
                      <span
                        className="absolute left-2 top-2 text-[10px] font-bold tracking-wide"
                        style={{ color: preset.textColor }}
                      >
                        CREDICEL
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={CREDICEL_LOGO_SRC}
                        alt=""
                        className="absolute right-1.5 top-1.5 h-4 w-auto object-contain opacity-95"
                      />
                      <span
                        className="absolute bottom-0 left-0 right-0 h-1.5"
                        style={{ background: preset.accentColor }}
                      />
                      {selected ? (
                        <span className="absolute bottom-2 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow-sm">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                    <div className="border-t border-line bg-white px-2 py-1.5">
                      <p className="truncate text-xs font-semibold text-ink">{preset.label}</p>
                      <p className="truncate text-[10px] text-muted">{preset.description}</p>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "group relative overflow-hidden rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  isCustomSelected
                    ? "border-brand ring-2 ring-brand/35"
                    : "border-dashed border-line hover:border-brand/40",
                )}
                aria-pressed={isCustomSelected}
              >
                <div className="relative flex aspect-[85.6/53.98] w-full items-center justify-center bg-page">
                  {isCustomSelected && backgroundPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={backgroundPreview}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 px-2 text-center text-muted">
                      <Upload className="h-5 w-5 text-brand" />
                      <span className="text-[10px] font-medium">JPG / PNG</span>
                    </div>
                  )}
                  {isCustomSelected ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow-sm">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </div>
                <div className="border-t border-line bg-white px-2 py-1.5">
                  <p className="truncate text-xs font-semibold text-ink">Mi diseño</p>
                  <p className="truncate text-[10px] text-muted">
                    {isCustomSelected ? "Activo · clic para cambiar" : "Cargar desde la PC"}
                  </p>
                </div>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Cargar
              </Button>
              {designId && isCardDesignPresetId(designId) ? (
                <p className="self-center text-xs text-muted">
                  Diseño activo:{" "}
                  <span className="font-semibold text-brand">
                    {CARD_DESIGN_PRESETS.find((p) => p.id === designId)?.label}
                  </span>
                </p>
              ) : isCustomSelected ? (
                <p className="self-center text-xs text-muted">
                  Diseño activo: <span className="font-semibold text-brand">Mi diseño</span>
                </p>
              ) : (
                <p className="self-center text-xs text-muted">
                  Sin diseño: silueta limpia con borde CREDICEL.
                </p>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
              onChange={(e) => {
                onChangeBackground(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
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
            {generating ? "Generando…" : "Generar PDF"}
          </Button>
          {generateProgress ? (
            <p className="text-center text-xs font-medium text-brand" aria-live="polite">
              {generateProgress}
            </p>
          ) : (
            <p className="text-center text-xs text-muted">
              Lotes grandes (más de {CARDS_PER_PDF_FILE}) se descargan en varios PDFs de hasta{" "}
              {CARDS_PER_PDF_FILE} tarjetas. El PDF solo se descarga después de ver la vista previa.
            </p>
          )}
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
      {/* Logo CREDICEL arriba-derecha (mismo lugar que en el PDF). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={CREDICEL_LOGO_SRC}
        alt=""
        className={
          large
            ? "pointer-events-none absolute right-2.5 top-2.5 z-10 h-8 w-auto object-contain drop-shadow-sm"
            : "pointer-events-none absolute right-1.5 top-1.5 z-10 h-5 w-auto object-contain drop-shadow-sm"
        }
      />
    </div>
  );
}
