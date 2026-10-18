import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Send,
  Archive,
  Monitor,
} from "lucide-react";
export default function OperationsTools({
  outreach,
  onReports,
  onArchive,
}: {
  outreach?: ReactNode;
  onReports: () => void;
  onArchive?: () => void;
}) {
  const [selected, setSelected] = useState(false);
  return (
    <>
      {selected ? (
        <>
          <button
            className="ops-text-button"
            onClick={() => setSelected(false)}
          >
            <ArrowLeft size={16} />
            Todas las herramientas
          </button>
          <section className="ops-embedded-tool">{outreach}</section>
        </>
      ) : (
        <>
          <div className="ops-page-title">
            <div>
              <span className="ops-eyebrow">
                LAS HERRAMIENTAS DE TU ESTUDIO
              </span>
              <h1>Del siguiente paso al trabajo hecho.</h1>
              <p>Informes y prospección, dentro del mismo espacio.</p>
            </div>
          </div>
          <div className="ops-tool-cards">
            <button onClick={onReports}>
              <span className="ops-document-icon">
                <FileText size={24} />
              </span>
              <span>
                <strong>Diagnósticos de restaurantes</strong>
                <small>
                  Busca un local, prepara el diagnóstico y llévalo a tu próxima
                  visita.
                </small>
              </span>
              <ArrowRight size={19} />
            </button>
            <button disabled={!outreach} onClick={() => setSelected(true)}>
              <span className="ops-document-icon">
                <Send size={23} />
              </span>
              <span>
                <strong>Prospección y campañas</strong>
                <small>
                  {outreach
                    ? "Revisa campañas y correos con las herramientas que ya utilizas."
                    : "Disponible al entrar en el Hub publicado."}
                </small>
              </span>
              <ArrowRight size={19} />
            </button>
          </div>
          <p className="ops-tools-note">
            <Monitor size={16} />
            Las campañas conservan su revisión y sus controles de envío.
          </p>
          {onArchive && (
            <button
              className="ops-text-button ops-archive-link"
              onClick={onArchive}
            >
              <Archive size={15} />
              Abrir el archivo del Hub anterior
            </button>
          )}
        </>
      )}
    </>
  );
}
