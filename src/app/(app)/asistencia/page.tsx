import { AttendanceStation } from "@/components/asistencia/attendance-station";

export const dynamic = "force-dynamic";

export default function AsistenciaPage() {
  return (
    <div className="space-y-6">
      <header className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-teal">Estación de sellos</p>
        <h1 className="font-display text-4xl">Control de asistencia de abonos</h1>
        <p className="mt-2 text-ink/65">
          Escanea la tarjeta. El sistema marca puntual o tardío según el día de corte. Cinco
          abonos puntuales desbloquean el premio.
        </p>
      </header>
      <AttendanceStation />
    </div>
  );
}
