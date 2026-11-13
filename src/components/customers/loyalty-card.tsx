"use client";

import Barcode from "react-barcode";
import { StreakPips } from "@/components/streak-pips";

export function LoyaltyCard({
  fullName,
  barcodeId,
  currentStreak = 0,
}: {
  fullName: string;
  barcodeId: string;
  currentStreak?: number;
}) {
  return (
    <div className="loyalty-card mx-auto overflow-hidden rounded-xl border border-line bg-white text-ink shadow-md">
      <div className="flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted">Fidelidad</p>
            <h3 className="font-display text-xl font-semibold leading-tight">{fullName}</h3>
          </div>
          <span className="rounded-lg bg-brand px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Programa
          </span>
        </div>
        <div className="flex justify-center py-1">
          <Barcode
            value={barcodeId}
            format="CODE128"
            width={1.6}
            height={52}
            displayValue
            fontSize={12}
            margin={4}
            background="transparent"
          />
        </div>
        <StreakPips current={currentStreak} size="sm" />
      </div>
    </div>
  );
}
