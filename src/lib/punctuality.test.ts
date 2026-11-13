import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePunctuality } from "@/lib/punctuality";
import { addBusinessCalendarDays, startOfBusinessDay } from "@/lib/business-time";

const settings = { cycleDays: 7, graceDays: 2 };

/** Fecha a mediodía UTC en un día de calendario (evita bordes de medianoche). */
function atNoonUtc(isoDate: string) {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

describe("evaluatePunctuality — ciclo 7+2 desde el abono", () => {
  it("primer abono (sin ancla) siempre es puntual", () => {
    const result = evaluatePunctuality(atNoonUtc("2026-03-01"), settings, null);
    assert.equal(result.isOnTime, true);
    assert.equal(result.hasAnchor, false);
    assert.equal(result.cycleDays, 7);
    assert.equal(result.graceDays, 2);
  });

  it("puntual dentro de la ventana 7+2 (día 9 inclusive)", () => {
    // Ancla lunes 2026-03-02 → plazo = 2 + 9 = 2026-03-11
    const anchor = atNoonUtc("2026-03-02");
    const onDeadline = atNoonUtc("2026-03-11");
    const result = evaluatePunctuality(onDeadline, settings, anchor);
    assert.equal(result.isOnTime, true);
    assert.equal(result.hasAnchor, true);

    const expectedDeadline = addBusinessCalendarDays(startOfBusinessDay(anchor), 9);
    assert.equal(startOfBusinessDay(result.deadline).getTime(), expectedDeadline.getTime());
  });

  it("puntual en el día 7 (antes de gracia) y en gracia (día 8)", () => {
    const anchor = atNoonUtc("2026-03-02");
    assert.equal(
      evaluatePunctuality(atNoonUtc("2026-03-09"), settings, anchor).isOnTime,
      true,
    );
    assert.equal(
      evaluatePunctuality(atNoonUtc("2026-03-10"), settings, anchor).isOnTime,
      true,
    );
  });

  it("tardío después de la ventana (día 10+)", () => {
    const anchor = atNoonUtc("2026-03-02");
    const late = evaluatePunctuality(atNoonUtc("2026-03-12"), settings, anchor);
    assert.equal(late.isOnTime, false);
    assert.equal(late.hasAnchor, true);
  });

  it("tras abono tardío/reset, el nuevo abono es ancla y reinicia la ventana", () => {
    // Cliente se pasó del plazo del ancla anterior; abona tarde el 2026-03-15.
    // Ese abono (aunque tardío) fija el nuevo ancla → siguiente ventana hasta 2026-03-24.
    const newAnchor = atNoonUtc("2026-03-15");
    const nextOnTime = evaluatePunctuality(atNoonUtc("2026-03-24"), settings, newAnchor);
    assert.equal(nextOnTime.isOnTime, true);

    const nextLate = evaluatePunctuality(atNoonUtc("2026-03-25"), settings, newAnchor);
    assert.equal(nextLate.isOnTime, false);
  });

  it("respeta cycleDays/graceDays configurables", () => {
    const custom = { cycleDays: 5, graceDays: 1 };
    const anchor = atNoonUtc("2026-04-01");
    // Ventana = 6 días → puntual el 2026-04-07, tardío el 2026-04-08
    assert.equal(evaluatePunctuality(atNoonUtc("2026-04-07"), custom, anchor).isOnTime, true);
    assert.equal(evaluatePunctuality(atNoonUtc("2026-04-08"), custom, anchor).isOnTime, false);
  });
});
