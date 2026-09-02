"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type RepairStatus = {
  database: "connected" | "unavailable" | string;
  drive: "ready" | "missing" | "unknown" | string;
  docs: "ready" | "missing" | "unknown" | string;
  repairRequired: string[];
};

type InspectResponse = {
  status?: RepairStatus;
  executable?: boolean;
  error?: string;
};

type RepairResponse = {
  changed?: boolean;
  before?: RepairStatus;
  after?: RepairStatus;
  error?: string;
};

const CONFIRMATION = "REPAIR_DRIVE_DOCS";

function stateLabel(value?: string) {
  if (value === "ready" || value === "connected") return "PRONTO";
  if (value === "missing") return "AUSENTE";
  if (value === "unavailable") return "INDISPONÍVEL";
  return "NÃO VERIFICADO";
}

export default function SchemaRepairPanel() {
  const [status, setStatus] = useState<RepairStatus | null>(null);
  const [executable, setExecutable] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Inspecionando o schema ativo…");
  const [error, setError] = useState("");

  async function inspect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/schema-repair", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as InspectResponse;
      if (!response.ok || !payload.status) throw new Error(payload.error || "Falha ao inspecionar schema");
      setStatus(payload.status);
      setExecutable(Boolean(payload.executable));
      setMessage(payload.status.repairRequired.length
        ? `Reparo necessário: ${payload.status.repairRequired.join(", ")}`
        : "Drive e Docs estão alinhados com o schema esperado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao inspecionar schema");
      setMessage("A inspeção não pôde ser concluída.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void inspect();
  }, []);

  async function repair() {
    if (confirmation !== CONFIRMATION || !executable || busy) return;
    setBusy(true);
    setError("");
    setMessage("Aplicando apenas correções aditivas e idempotentes…");
    try {
      const response = await fetch("/api/admin/schema-repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = await response.json().catch(() => ({})) as RepairResponse;
      if (!response.ok || !payload.after) throw new Error(payload.error || "Falha ao reparar schema");
      setStatus(payload.after);
      setExecutable(payload.after.repairRequired.length > 0);
      setConfirmation("");
      setMessage(payload.after.repairRequired.length === 0
        ? payload.changed ? "Reparo aplicado e validado. Drive e Docs estão prontos." : "Nenhuma alteração necessária."
        : `Ainda há reparos pendentes: ${payload.after.repairRequired.join(", ")}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao reparar schema");
      setMessage("O reparo foi interrompido sem confirmação de sucesso.");
    } finally {
      setBusy(false);
    }
  }

  const canRepair = useMemo(
    () => executable && confirmation === CONFIRMATION && !busy,
    [confirmation, executable, busy],
  );

  return (
    <section className={styles.schemaPanel} aria-live="polite">
      <div className={styles.schemaIntro}>
        <p className="eyebrow">SCHEMA CONTROL · SUPERADMIN</p>
        <h2>Integridade de Drive e Docs</h2>
        <p>Inspeção do banco ativo e reparo estritamente aditivo. Nenhuma ação destrutiva ou exclusão de dados é executada por este painel.</p>
      </div>

      <div className={styles.schemaStates}>
        <div><span>BANCO</span><strong>{stateLabel(status?.database)}</strong></div>
        <div><span>DRIVE</span><strong>{stateLabel(status?.drive)}</strong></div>
        <div><span>DOCS</span><strong>{stateLabel(status?.docs)}</strong></div>
      </div>

      <div className={styles.schemaMessage} data-error={Boolean(error)}>
        <span>{busy ? "PROCESSANDO" : error ? "ATENÇÃO" : "STATUS"}</span>
        <p>{error || message}</p>
      </div>

      {executable ? (
        <div className={styles.schemaAction}>
          <label htmlFor="schema-confirmation">Digite <code>{CONFIRMATION}</code> para liberar o reparo</label>
          <div>
            <input
              id="schema-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
            <button type="button" onClick={() => void repair()} disabled={!canRepair}>
              {busy ? "Validando…" : "Reparar e validar"}
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.schemaRefresh} type="button" onClick={() => void inspect()} disabled={busy}>
          {busy ? "Inspecionando…" : "Reinspecionar schema"}
        </button>
      )}
    </section>
  );
}
