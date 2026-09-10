import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminConversationFlow,
  type ConversationFlowData,
  type ConversationFlowIntent,
} from "../api/client";

interface AdminConversationFlowProps {
  apiOnline: boolean | null;
}

/** Staff map: what user says → where the agent goes → which form questions. */
export function AdminConversationFlow({ apiOnline }: AdminConversationFlowProps) {
  const [data, setData] = useState<ConversationFlowData | null>(null);
  const [selected, setSelected] = useState<ConversationFlowIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (apiOnline === false) return;
    try {
      const next = await fetchAdminConversationFlow();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load flow");
    } finally {
      setLoading(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="adm-stack">
      <section className="adm-card" aria-label="Session phases">
        <div className="adm-card-head">
          <div>
            <h2 className="kn">ಸಂವಾದ ಹರಿವು · Conversation flow</h2>
            <p className="adm-card-meta">How speech moves from greeting → listen → intent → form or answer</p>
          </div>
          <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <div className="adm-card-body">
          {loading && <p className="adm-muted">Loading flow…</p>}
          {error && <p className="api-warning">{error}</p>}
          {data && (
            <>
              <ol className="adm-flow-phases">
                {data.phases.map((phase) => (
                  <li key={phase.id}>
                    <strong>{phase.title}</strong>
                    <span>{phase.detail}</span>
                  </li>
                ))}
              </ol>
              {data.notes?.length > 0 && (
                <ul className="adm-flow-notes">
                  {data.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {data && (
        <section className="adm-card" aria-label="Intent routing">
          <div className="adm-card-head">
            <div>
              <h2>Intent → destination</h2>
              <p className="adm-card-meta">Click a row to see form questions the agent will ask</p>
            </div>
          </div>
          <div className="adm-card-body">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Intent</th>
                    <th>Route</th>
                    <th>Goes to</th>
                    <th>Example phrases</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.intents.map((row) => (
                    <tr key={row.intent}>
                      <td>
                        <code>{row.intent}</code>
                      </td>
                      <td>
                        <span
                          className={`adm-table-badge ${
                            row.route === "transactional" ? "is-active" : "is-done"
                          }`}
                        >
                          {row.route}
                        </span>
                      </td>
                      <td>
                        {row.form_id ? (
                          <>
                            <div className="kn">{row.form_title_kn}</div>
                            <div className="adm-table-muted">
                              {row.form_title_en} · <code>{row.form_id}</code>
                            </div>
                          </>
                        ) : (
                          <span className="adm-table-muted">Spoken answer only</span>
                        )}
                      </td>
                      <td className="adm-table-muted kn">
                        {(row.example_phrases || []).slice(0, 2).join(" · ") || "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="adm-btn adm-btn--outline adm-btn--sm"
                          onClick={() => setSelected(row)}
                        >
                          Questions
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {selected && (
        <section className="adm-card" aria-label="Form questions">
          <div className="adm-card-head">
            <div>
              <h2>
                {selected.form_title_en || selected.intent} · questions
              </h2>
              <p className="adm-card-meta">{selected.next_step}</p>
            </div>
            <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div className="adm-card-body">
            {selected.fields.length === 0 ? (
              <p className="adm-muted">No form fields — agent speaks an informational answer.</p>
            ) : (
              <ol className="adm-flow-questions">
                {selected.fields.map((field, index) => (
                  <li key={field.id}>
                    <strong>
                      Q{index + 1}. {field.label_en}
                    </strong>
                    <span className="kn">{field.prompt_kn}</span>
                    <span className="adm-table-muted">
                      type: {field.type}
                      {field.required ? " · required" : " · optional"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="adm-card-lead">
              After each answer the agent confirms (ಹೌದು / ಮತ್ತೆ ಹೇಳಿ). At the end it reads a summary
              and asks if everything is correct before print/submit.
            </p>
          </div>
        </section>
      )}

      {data && (
        <section className="adm-card" aria-label="Commands and menu">
          <div className="adm-card-head">
            <div>
              <h2>Always-on voice commands</h2>
              <p className="adm-card-meta">Work during assist and form filling</p>
            </div>
          </div>
          <div className="adm-card-body adm-flow-commands">
            {Object.entries(data.voice_commands).map(([key, phrases]) => (
              <div key={key}>
                <strong>{key}</strong>
                <p className="adm-table-muted">{phrases.join(" · ")}</p>
              </div>
            ))}
          </div>
          <div className="adm-card-body">
            <h3>Form menu (when customer asks for a form)</h3>
            <ol className="adm-flow-questions">
              {data.form_menu.map((item) => (
                <li key={item.id}>
                  <strong>
                    {item.index}. {item.title_en}
                  </strong>
                  <span className="kn">{item.title_kn}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}
