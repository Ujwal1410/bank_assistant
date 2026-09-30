import { useCallback, useEffect, useState } from "react";
import {
  base64ToAudioUrl,
  fetchAdminHistory,
  fetchAdminHistoryItem,
  formatHistoryTime,
  formatIntentLabel,
  type HistoryItem,
} from "../api/client";

interface AdminSpeechHistoryProps {
  apiOnline: boolean | null;
}

/** Staff view of what customers said and how the agent routed each turn. */
export function AdminSpeechHistory({ apiOnline }: AdminSpeechHistoryProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (apiOnline === false) return;
    try {
      const next = await fetchAdminHistory(80);
      setItems(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load speech history");
    } finally {
      setLoading(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selected?.audio_b64) {
      setAudioUrl(null);
      return;
    }
    const url = base64ToAudioUrl(selected.audio_b64);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selected]);

  const openItem = async (id: number | string) => {
    try {
      const item = await fetchAdminHistoryItem(id);
      setSelected(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open turn");
    }
  };

  return (
    <div className="adm-stack">
      <section className="adm-card" aria-label="Speech history">
        <div className="adm-card-head">
          <div>
            <h2 className="kn">ಮಾತು ಇತಿಹಾಸ · Speech turns</h2>
            <p className="adm-card-meta">
              What the customer said → intent / route → agent response (live kiosk turns)
            </p>
          </div>
          <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <div className="adm-card-body">
          {loading && <p className="adm-muted">Loading…</p>}
          {error && <p className="api-warning">{error}</p>}
          {!loading && items.length === 0 && (
            <p className="adm-muted">No speech turns yet. Run a customer conversation on the agent screen.</p>
          )}
          {items.length > 0 && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Customer said (KN)</th>
                    <th>English</th>
                    <th>Intent</th>
                    <th>Route</th>
                    <th>Conf.</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={String(item.id)}>
                      <td className="adm-table-muted">{formatHistoryTime(item.created_at)}</td>
                      <td className="kn">{item.kannada_text || "—"}</td>
                      <td className="adm-table-muted">{item.english_text || "—"}</td>
                      <td>
                        <span className="adm-table-badge is-active">
                          {formatIntentLabel(item.intent || "—")}
                        </span>
                      </td>
                      <td>{item.route || "—"}</td>
                      <td className="adm-table-muted">
                        {typeof item.confidence === "number"
                          ? `${Math.round(item.confidence * 100)}%`
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="adm-btn adm-btn--outline adm-btn--sm"
                          onClick={() => void openItem(item.id)}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {selected && (
        <section className="adm-card" aria-label="Turn detail">
          <div className="adm-card-head">
            <div>
              <h2>Turn detail</h2>
              <p className="adm-card-meta">{formatHistoryTime(selected.created_at)}</p>
            </div>
            <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div className="adm-card-body adm-flow-detail">
            <p>
              <strong>Kannada:</strong> <span className="kn">{selected.kannada_text}</span>
            </p>
            <p>
              <strong>English:</strong> {selected.english_text}
            </p>
            <p>
              <strong>Intent → route:</strong> {selected.intent} → {selected.route}
            </p>
            <p>
              <strong>Agent reply:</strong> {selected.response_text || "—"}
            </p>
            {audioUrl && (
              <audio controls src={audioUrl}>
                <track kind="captions" />
              </audio>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
