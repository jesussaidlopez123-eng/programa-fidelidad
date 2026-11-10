"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";

export function WebcamScanner({ onScan }: { onScan: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regionId = "webcam-scan-region";
  const onScanRef = useRef(onScan);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      try {
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 8,
            qrbox: { width: 280, height: 120 },
          },
          (decoded) => {
            onScanRef.current(decoded);
            setOpen(false);
          },
          () => undefined,
        );
      } catch {
        if (!cancelled) {
          setError("No se pudo abrir la cámara. Permite el acceso o usa el lector USB.");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => undefined);
    };
  }, [open]);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null);
          setOpen((value) => !value);
        }}
      >
        {open ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {open ? "Cerrar cámara" : "Escanear con cámara"}
      </Button>
      {open ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-ink p-3">
          <div id={regionId} className="min-h-[180px] overflow-hidden rounded-xl bg-black" />
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
