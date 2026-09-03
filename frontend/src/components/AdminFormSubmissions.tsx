import { useCallback, useEffect, useState } from "react";
import { fetchFormSubmissions, type FormSubmissionItem } from "../api/client";
import { displayFieldValue } from "../utils/formSummary";

interface AdminFormSubmissionsProps {
  apiOnline: boolean | null;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function summarizeValues(values: Record<string, string>): string {
  const acct = values.account_number?.trim();
  if (acct) {
    return displayFieldValue("account_number", "digits", acct);
  }
  const name =
    values.full_name?.trim() ||
    values.name?.trim() ||
    values.applicant_name?.trim() ||
    values.beneficiary_name?.trim();
  if (name) return name;
  const first = Object.values(values).find((v) => v?.trim());
  return first?.trim() || "—";
}

/** Staff view of recent voice form submissions. */
export function AdminFormSubmissions({ apiOnline }: AdminFormSubmissionsProps) {
  const [items, setItems] = useState<FormSubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (apiOnline === false) return;
    try {
      const next = await fetchFormSubmissions(30);
      setItems(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load submissions");
    } finally {
      setLoading(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <section className="adm-card adm-submissions" id="form-submissions" aria-label="Form submissions">
      <header className="adm-card-head">
        <div>
          <h2>Form submissions</h2>
          <p className="kn">ಅರ್ಜಿ ಸಲ್ಲಿಕೆಗಳು</p>
        </div>
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-btn--sm"
          disabled={apiOnline === false || loading}
          onClick={() => {
            setLoading(true);
            void refresh();
          }}
        >
          Refresh
        </button>
      </header>
      <div className="adm-card-body">
        {loading && items.length === 0 && (
          <p className="adm-muted" role="status">
            Loading submissions…
          </p>
        )}
        {error && (
          <p className="adm-alert adm-alert--error adm-alert--inline" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="adm-muted">No form submissions yet today.</p>
        )}
        {items.length > 0 && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Summary</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title_en}</strong>
                      <span className="adm-table-kn kn">{item.title_kn}</span>
                    </td>
                    <td className="adm-table-muted">{summarizeValues(item.values)}</td>
                    <td>{formatTime(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
