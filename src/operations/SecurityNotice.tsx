import { ArrowDownToLine } from "lucide-react";
import type { Business } from "./api";
import { date } from "./api";

export default function SecurityNotice({
  business,
  connected,
}: {
  business: Business;
  connected: boolean;
}) {
  const security = business.security;
  if (!security) return null;
  return (
    <section className="ops-security-detail">
      <span className="ops-eyebrow">
        EVIDENCIA DE SEGURIDAD · {date(security.measuredAt)}
      </span>
      <h3>Enlaces ocultos en {security.affectedPages} páginas</h3>
      <p>
        Hallazgo guardado. Hay que comprobar si se ha corregido antes de
        presentarlo como un problema actual.
      </p>
      {business.reports
        .filter((r) => r.type === "seguridad")
        .map((r) => (
          <a
            className={`ops-secondary ${!connected ? "disabled" : ""}`}
            key={r.type}
            href={connected ? r.url : undefined}
            target="_blank"
            rel="noreferrer"
          >
            Ver informe de seguridad <ArrowDownToLine size={16} />
          </a>
        ))}
      <details>
        <summary>Ver páginas de la evidencia</summary>
        {security.evidence.map((url) => (
          <p key={url}>{url}</p>
        ))}
        <small>Fuente: {security.source}</small>
      </details>
    </section>
  );
}
