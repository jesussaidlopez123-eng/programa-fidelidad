"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadRewardPhoto } from "@/app/actions/gifts";
import { blobToBase64, compressImageToJpeg } from "@/lib/image-compress";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EvidenceCard = {
  id: string;
  rewardName: string;
  unlockedAt: Date | string;
  unlockedByName: string | null;
  customer: { id: string; fullName: string; barcodeId: string };
};

export function EvidenciasBoard({ items }: { items: EvidenceCard[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-white px-5 py-12 text-center text-sm text-muted">
        No hay premios del día pendientes de foto. Cuando un cliente gane y se elija «Subir después»,
        aparecerá aquí.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <EvidenceItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function EvidenceItem({ item }: { item: EvidenceCard }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    try {
      setBusy(true);
      const compressed = await compressImageToJpeg(file);
      setPreview(compressed.dataUrl);
      setBlob(compressed.blob);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo procesar la foto.");
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!blob) {
      toast.error("Elige o toma una foto primero.");
      return;
    }
    setBusy(true);
    try {
      const base64 = await blobToBase64(blob);
      const result = await uploadRewardPhoto({
        rewardId: item.id,
        base64,
        mimeType: "image/jpeg",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Foto de ${item.customer.fullName} guardada`);
      router.refresh();
    } catch {
      toast.error("No se pudo subir la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Premio del día</p>
          <h2 className="font-display text-2xl font-semibold">{item.customer.fullName}</h2>
          <p className="font-mono text-xs text-brand">{item.customer.barcodeId}</p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>{formatDate(item.unlockedAt)}</p>
          {item.unlockedByName ? <p>Sucursal: {item.unlockedByName}</p> : null}
        </div>
      </div>

      <p className="mt-3 rounded-2xl bg-page px-3 py-2 text-sm font-medium">{item.rewardName}</p>

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Vista previa"
          className="mt-4 max-h-56 w-full rounded-2xl object-cover ring-1 ring-line"
        />
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Archivo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          Cámara
        </Button>
        <Button type="button" className="flex-1" disabled={busy || !blob} onClick={() => void upload()}>
          {busy ? "Subiendo…" : "Subir foto"}
        </Button>
      </div>
    </article>
  );
}
