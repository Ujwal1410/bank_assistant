import { useEffect, useState } from "react";
import { checkHealth, fetchAdminMe } from "./api/client";
import { clearAdminSession, getAdminUsername, isAdminLoggedIn } from "./auth/adminSession";
import { AdminLogin } from "./components/AdminLogin";
import { AdminPanel } from "./components/AdminPanel";
import { getLobbyUrl } from "./utils/apiBase";
import { startVisibilityAwarePoll } from "./utils/polling";

/** Staff console — lobby & voice assistant control. */
export function AdminApp() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [adminAuthed, setAdminAuthed] = useState(() => isAdminLoggedIn());
  const [adminChecking, setAdminChecking] = useState(false);
  const username = getAdminUsername() ?? "Staff";

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const probe = () => {
      checkHealth().then((ok) => {
        if (cancelled) return;
        setConnected(ok);
        if (!ok && attempts < 10) {
          attempts += 1;
          window.setTimeout(probe, 1500);
        }
      });
    };
    probe();
    const stop = startVisibilityAwarePoll(() => {
      checkHealth().then((ok) => {
        if (!cancelled) setConnected(ok);
      });
    }, 10000, 30000);
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  useEffect(() => {
    if (!isAdminLoggedIn()) {
      setAdminAuthed(false);
      return;
    }
    let cancelled = false;
    setAdminChecking(true);
    fetchAdminMe().then((me) => {
      if (cancelled) return;
      if (me) setAdminAuthed(true);
      else {
        clearAdminSession();
        setAdminAuthed(false);
      }
      setAdminChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (adminChecking) {
    return (
      <div className="adm-gate-loading adm-gate-loading--fullscreen">
        <span className="adm-spinner" aria-hidden />
        <p>Verifying session…</p>
      </div>
    );
  }

  if (!adminAuthed) {
    return <AdminLogin apiOnline={connected} onSuccess={() => setAdminAuthed(true)} />;
  }

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar" aria-label="Navigation">
        <div className="adm-sidebar-brand">
          <span className="adm-sidebar-logo kn" aria-hidden>
            ಕ
          </span>
          <div>
            <strong className="kn">ಕನ್ನಡ ವಾಯ್ಸ್ ಬ್ಯಾಂಕಿಂಗ್</strong>
            <span>Voice banking</span>
          </div>
        </div>

        <p className="adm-sidebar-tag">Staff console</p>

        <nav className="adm-sidebar-nav">
          <a className="adm-nav-item is-active" href="/" aria-current="page">
            <svg className="adm-nav-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 13h6v7H4v-7zm10-9h6v16h-6V4zM4 4h6v5H4V4z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <span className="kn">ಲಂಬಿ ನಿಯಂತ್ರಣ</span>
              <span className="adm-nav-sub">Lobby control</span>
            </span>
          </a>
          <a className="adm-nav-item" href="/#form-submissions">
            <svg className="adm-nav-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 4h12v16H6V4zm2 2v12h8V6H8zm2 2h4v2h-4V8zm0 4h4v2h-4v-2z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <span className="kn">ಅರ್ಜಿ ಸಲ್ಲಿಕೆಗಳು</span>
              <span className="adm-nav-sub">Form submissions</span>
            </span>
          </a>
        </nav>

        <div className="adm-sidebar-foot">
          <div
            className={`adm-conn ${connected ? "is-on" : connected === false ? "is-off" : ""}`}
            title={connected ? "Service connected" : connected === false ? "Service offline" : "Checking…"}
          >
            <span className="adm-conn-dot" aria-hidden />
            {connected ? "Service online" : connected === false ? "Service offline" : "Connecting…"}
          </div>
        </div>
      </aside>

      <div className="adm-body">
        <header className="adm-topbar">
          <div className="adm-topbar-titles">
            <p className="adm-topbar-crumb">Staff · Dashboard</p>
            <h1 className="kn">ಲಂಬಿ ನಿಯಂತ್ರಣ</h1>
          </div>
          <div className="adm-topbar-actions">
            <span className="adm-user-chip">{username}</span>
            <button
              type="button"
              className="adm-btn adm-btn--outline adm-btn--sm"
              onClick={() => window.open(getLobbyUrl(), "_blank", "noopener,noreferrer")}
            >
              Customer screen ↗
            </button>
          </div>
        </header>

        <main className="adm-page">
          <AdminPanel
            apiOnline={connected}
            username={username}
            onOpenLobby={() => window.open(getLobbyUrl(), "_blank", "noopener,noreferrer")}
            onLogout={() => setAdminAuthed(false)}
          />
        </main>
      </div>
    </div>
  );
}
