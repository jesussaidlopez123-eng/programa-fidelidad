"use client";

import { useRef, useState } from "react";
import { Camera, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadRewardPhoto } from "@/app/actions/gifts";
import { markRewardDelivered } from "@/app/actions/attendance";
import { blobToBase64, compressImageToJpeg } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type WinPrize = {
  id: string;
  name: string;
  customer: string;
};

export function WinPhotoModal({
  prize,
  onClose,
}: {
  prize: WinPrize | null;
  onClose: () => void;
}) {
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

  function resetLocal() {
    setPreview(null);
    setBlob(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  async function uploadNow() {
    if (!prize || !blob) {
      toast.error("Elige o toma una foto primero.");
      return;
    }
    setBusy(true);
    try {
      const base64 = await blobToBase64(blob);
      const result = await uploadRewardPhoto({
        rewardId: prize.id,
        base64,
        mimeType: "image/jpeg",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Foto guardada en la ficha del cliente");
      resetLocal();
      onClose();
    } catch {
      toast.error("No se pudo subir la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!prize}
      onOpenChange={(next) => {
        if (!next) {
          resetLocal();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto overflow-x-hidden bg-forest text-cream">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          {Array.from({ length: 22 }).map((_, index) => (
            <span
              key={index}
              className="absolute h-2 w-2 rounded-full bg-gold confetti"
              style={{
                left: `${(index * 17) % 100}%`,
                animationDelay: `${index * 0.08}s`,
              }}
            />
          ))}
        </div>

        <DialogHeader className="relative">
          <DialogTitle className="flex flex-col items-center gap-2 text-center text-3xl text-gold sm:text-4xl">
            <Sparkles className="h-8 w-8" />
            ¡EL CLIENTE GANÓ!
          </DialogTitle>
          <DialogDescription className="text-center text-base text-cream/80">
            <span className="block font-semibold text-cream">{prize?.customer}</span>
            <span className="mt-1 block">{prize?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-4 space-y-4">
          <div className="rounded-3xl border border-cream/15 bg-white/5 p-4">
            <p className="mb-3 text-center text-sm text-cream/70">
              Sube una foto del cliente con su premio (archivo o cámara). Se comprime en el navegador
              (~1000 px, ~300 KB) y se guarda en la base de datos.
            </p>

            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Vista previa"
                className="mx-auto max-h-64 w-full max-w-md rounded-2xl object-cover ring-2 ring-gold/40"
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-cream/25 text-sm text-cream/50">
                Sin vista previa
              </div>
            )}

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
                className="flex-1 border-cream/20 bg-transparent text-cream hover:bg-white/10"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Elegir archivo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-cream/20 bg-transparent text-cream hover:bg-white/10"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Tomar foto
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="gold"
              className="flex-1"
              disabled={busy || !blob}
              onClick={() => void uploadNow()}
            >
              {busy ? "Subiendo…" : "Subir foto"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-cream/20 bg-transparent text-cream hover:bg-white/10"
              disabled={busy}
              onClick={() => {
                toast.message("La foto quedó pendiente en Evidencias");
                resetLocal();
                onClose();
              }}
            >
              Subir después
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full text-cream/70 hover:bg-white/10 hover:text-cream"
            disabled={busy}
            onClick={async () => {
              if (!prize) return;
              await markRewardDelivered(prize.id);
              toast.success("Premio marcado como entregado");
              resetLocal();
              onClose();
            }}
          >
            Marcar premio como entregado (sin foto)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
