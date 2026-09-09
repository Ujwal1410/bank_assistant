import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminLogout,
  endKioskSessionAsAdmin,
  fetchKioskStatus,
  fetchKioskStatusLite,
  startKiosk,
  stopKiosk,
  type KioskStatus,
} from "../api/client";
import { startVisibilityAwarePoll } from "../utils/polling";
import { AdminFormSubmissions } from "./AdminFormSubmissions";
import { AdminVoiceSettings } from "./AdminVoiceSettings";

interface AdminPanelProps {
  apiOnline: boolean | null;
  username: string;
  onOpenLobby: () => void;
  onLogout: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "idle":
      return "Waiting";
    case "greeting":
      return "Greeting";
    case "conversation":
      return "In conversation";
    case "stopped":
      return "Closed";
    case "ended":
      return "Completed";
    default:
      return phase.charAt(0).toUpperCase() + phase.slice(1);
  }
}

function phaseLabelKn(phase: string): string {
  switch (phase) {
    case "idle":
      return "ಕಾಯುತ್ತಿದೆ";
    case "greeting":
      return "ಸ್ವಾಗತಿಸುತ್ತಿದೆ";
    case "conversation":
      return "ಸಂಭಾಷಣೆ";
    case "stopped":
      return "ಮುಚ್ಚಿದೆ";
    case "ended":
      return "ಪೂರ್ಣಗೊಂಡಿದೆ";
    default:
      return phase;
  }
}

/** Map backend event strings to staff-friendly labels (no internal names). */
function friendlyEvent(event: string | null | undefined): string {
  if (!event) return "—";
  const known: Record<string, string> = {
    "Kiosk not started": "Lobby not started",
    "Admin started agent kiosk": "Lobby opened",
    "Admin stopped agent kiosk": "Lobby closed",
    "Person detected near kiosk": "Customer at counter",
    "Waiting for customer": "Waiting for customer",
    "Greeting customer": "Greeting customer",
    "Session ended — waiting for next customer": "Session ended",
    "Ended by admin": "Session ended by staff",
    "Ended on agent screen": "Customer finished at counter",
  };
  if (known[event]) return known[event];
  return event
    .replace(/kiosk/gi, "lobby")
    .replace(/agent kiosk/gi, "lobby")
    .replace(/^Admin /i, "");
}

function customerLabelKn(label: string): string {
  switch (label) {
    case "Customer at counter":
      return "ಗ್ರಾಹಕರು ಕೌಂಟರ್ ಬಳಿ";
    case "Session active":
      return "ಸಂವಾದ ಸಕ್ರಿಯವಾಗಿದೆ";
    case "Waiting for customer":
      return "ಗ್ರಾಹಕರಿಗಾಗಿ ಕಾಯುತ್ತಿದೆ";
    default:
      return "ಯಾವುದೇ ಸಂವಾದ ನಡೆಯುತ್ತಿಲ್ಲ";
  }
}

function friendlyNote(note: string): string {
  if (!note) return "";
  const known: Record<string, string> = {
    "Ended on agent screen": "Customer left counter",
    "Ended by admin": "Ended by staff",
  };
  return known[note] ?? note;
}

/** Staff dashboard — lobby, voice, sessions. */
export function AdminPanel({ apiOnline, username, onOpenLobby, onLogout }: AdminPanelProps) {
  const [status, setStatus] = useState<KioskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const statusFailures = useRef(0);
  const hasLoadedStatus = useRef(false);
  const statusGraceUntil = useRef(Date.now() + 60_000);

  const refreshLite = useCallback(async () => {
    try {
      const s = await fetchKioskStatusLite();
      setStatus((prev) => ({ ...prev, ...s, sessions: prev?.sessions ?? [] }));
      hasLoadedStatus.current = true;
      statusFailures.current = 0;
      setError(null);
    } catch (err) {
      if (!hasLoadedStatus.current && Date.now() < statusGraceUntil.current) return;
      statusFailures.current += 1;
      if (statusFailures.current >= 3) {
        setError(err instanceof Error ? err.message : "Could not refresh status");
      }
    }
  }, []);

  const refreshFull = useCallback(async () => {
    try {
      const s = await fetchKioskStatus();
      setStatus(s);
      hasLoadedStatus.current = true;
      statusFailures.current = 0;
      setError(null);
    } catch (err) {
      if (!hasLoadedStatus.current && Date.now() < statusGraceUntil.current) return;
      statusFailures.current += 1;
      if (statusFailures.current >= 3) {
        setError(err instanceof Error ? err.message : "Could not refresh status");
      }
    }
  }, []);

  useEffect(() => {
    void refreshFull();
    const stopLite = startVisibilityAwarePoll(() => refreshLite(), 5000, 20000);
    const stopFull = startVisibilityAwarePoll(() => refreshFull(), 20000, 60000);
    return () => {
      stopLite();
      stopFull();
    };
  }, [refreshLite, refreshFull]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      setStatus(await startKiosk());
      flash("Lobby is open — ready for customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open lobby");
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      setStatus(await stopKiosk());
      flash("Lobby closed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close lobby");
    } finally {
      setBusy(false);
    }
  };

  const handleEndSession = async () => {
    setBusy(true);
    try {
      setStatus(await endKioskSessionAsAdmin("Ended by admin"));
      flash("Customer session ended");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end session");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    onLogout();
  };

  const statusLoading = status === null;
  const running = status?.running ?? false;
  const phase = status?.phase ?? "stopped";
  const sessions = status?.sessions ?? [];
  const activeSession = Boolean(status?.current_session_id);

  const hint = useMemo(() => {
    if (!running) return "Open the lobby when your counter is ready for customers.";
    if (phase === "idle") return "Waiting for a customer at the counter.";
    if (phase === "greeting") return "Voice assistant is welcoming the customer in Kannada.";
    if (phase === "conversation") return "Voice assistant is helping the customer.";
    return friendlyEvent(status?.last_event);
  }, [running, phase, status?.last_event]);

  const customerLabel = useMemo(() => {
    if (!running) return "No active session";
    if (status?.person_present) return "Customer at counter";
    if (activeSession) return "Session active";
    return "Waiting for customer";
  }, [running, status?.person_present, activeSession]);

  return (
    <div className="adm-dashboard">
      {apiOnline === false && (
        <div className="adm-alert adm-alert--warn" role="alert">
          Cannot reach the banking service. Check that the backend is running.
        </div>
      )}
      {error && (
        <div className="adm-alert adm-alert--error" role="alert">
          {error}
        </div>
      )}
      {toast && <div className="adm-alert adm-alert--ok">{toast}</div>}

      <section className={`adm-hero ${running ? "is-live" : "is-idle"}`} aria-label="Lobby status">
        <div className="adm-hero-ring-wrap">
          <span className={`adm-hero-ring ${running ? "is-live" : ""}`} aria-hidden />
          <span className="adm-hero-mark">{running ? "●" : "○"}</span>
        </div>
        <div className="adm-hero-copy">
          <p className="adm-hero-eyebrow">Voice banking lobby</p>
          <h2>
            {statusLoading ? "Loading…" : running ? "Lobby open" : "Lobby closed"}
          </h2>
          <p className="adm-hero-kn kn">
            {statusLoading
              ? "ಮಾಹಿತಿ ಪಡೆಯಲಾಗುತ್ತಿದೆ…"
              : running
                ? "ಲಾಬಿ ತೆರೆದಿದೆ"
                : "ಲಾಬಿ ಮುಚ್ಚಿದೆ"}
          </p>
          <p className="adm-hero-hint">{statusLoading ? "Fetching lobby status…" : hint}</p>
          {running && (
            <div className="adm-hero-tags">
              <span className="adm-pill">
                {phaseLabel(phase)} · <span className="kn">{phaseLabelKn(phase)}</span>
              </span>
              {status?.person_present && (
                <span className="adm-pill adm-pill--green">
                  At counter · <span className="kn">ಕೌಂಟರ್ ಬಳಿ</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="adm-hero-actions">
          {statusLoading ? (
            <div className="adm-hero-loading" role="status">
              <span className="adm-spinner" aria-hidden />
              <span>Loading status…</span>
            </div>
          ) : !running ? (
            <>
              <button
                type="button"
                className="adm-btn adm-btn--gold adm-btn--lg"
                disabled={busy || apiOnline === false}
                onClick={() => void handleStart()}
              >
                {busy ? "Opening…" : "Open lobby"}
              </button>
              <button type="button" className="adm-btn adm-btn--outline" onClick={onOpenLobby}>
                Preview customer screen
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="adm-btn adm-btn--danger adm-btn--lg"
                disabled={busy}
                onClick={() => void handleStop()}
              >
                {busy ? "Closing…" : "Close lobby"}
              </button>
              {activeSession && (
                <button
                  type="button"
                  className="adm-btn adm-btn--outline"
                  disabled={busy}
                  onClick={() => void handleEndSession()}
                >
                  End session
                </button>
              )}
              <button type="button" className="adm-btn adm-btn--ghost" onClick={onOpenLobby}>
                Customer screen ↗
              </button>
            </>
          )}
        </div>
      </section>

      <div className="adm-stats">
        <article className="adm-stat-card">
          <span className="adm-stat-icon" aria-hidden>🕐</span>
          <div>
            <span className="adm-stat-label">Shift opened</span>
            <strong>{formatTime(status?.started_at ?? null)}</strong>
          </div>
        </article>
        <article className="adm-stat-card">
          <span className="adm-stat-icon" aria-hidden>👤</span>
          <div>
            <span className="adm-stat-label">Customer</span>
            <strong>{customerLabel}</strong>
            <span className="adm-stat-kn kn">{customerLabelKn(customerLabel)}</span>
          </div>
        </article>
        <article className="adm-stat-card">
          <span className="adm-stat-icon" aria-hidden>📋</span>
          <div>
            <span className="adm-stat-label">Last activity</span>
            <strong>{friendlyEvent(status?.last_event)}</strong>
          </div>
        </article>
        <article className="adm-stat-card adm-stat-card--accent">
          <span className="adm-stat-icon" aria-hidden>📊</span>
          <div>
            <span className="adm-stat-label">Today&apos;s visits</span>
            <strong className="adm-stat-num">{sessions.length}</strong>
          </div>
        </article>
      </div>

      <div className="adm-grid">
        <section className="adm-card">
          <header className="adm-card-head">
            <div>
              <h2>Quick guide</h2>
              <p className="kn">ಪ್ರಾರಂಭಿಸುವುದು ಹೇಗೆ</p>
            </div>
            <span className="adm-card-meta">{username}</span>
          </header>
          <div className="adm-card-body">
            <ol className="adm-steps">
              <li>
                <span className="adm-step-num">1</span>
                <div>
                  <strong>Open lobby</strong>
                  <span className="kn">ಲಾಬಿ ತೆರೆಯಿರಿ</span>
                  <p>When your counter is ready for customers.</p>
                </div>
              </li>
              <li>
                <span className="adm-step-num">2</span>
                <div>
                  <strong>Show customer screen</strong>
                  <span className="kn">ಗ್ರಾಹಕ ಪರದೆ</span>
                  <p>Display the customer screen on the counter monitor.</p>
                </div>
              </li>
              <li>
                <span className="adm-step-num">3</span>
                <div>
                  <strong>Assistant greets</strong>
                  <span className="kn">ಸಹಾಯಕ ಸ್ವಾಗತಿಸುತ್ತದೆ</span>
                  <p>Customers are welcomed in natural Kannada.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <AdminVoiceSettings apiOnline={apiOnline} />
      </div>

      <AdminFormSubmissions apiOnline={apiOnline} />

      {sessions.length > 0 && (
        <section className="adm-card adm-sessions">
          <header className="adm-card-head">
            <div>
              <h2>Today&apos;s visits</h2>
              <p className="kn">ಇಂದಿನ ಭೇಟಿಗಳು</p>
            </div>
            <span className="adm-card-meta">{sessions.length} total</span>
          </header>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className={`adm-table-badge ${s.ended_at ? "is-done" : "is-active"}`}>
                        {s.ended_at ? "Completed" : phaseLabel(s.phase)}
                      </span>
                    </td>
                    <td>{formatTime(s.started_at)}</td>
                    <td className="adm-table-muted">{s.note ? friendlyNote(s.note) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="adm-page-foot">
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => void handleLogout()}>
          Sign out
        </button>
      </footer>
    </div>
  );
}
