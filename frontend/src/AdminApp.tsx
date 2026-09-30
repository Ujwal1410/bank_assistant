import { useEffect, useState } from "react";
import { checkHealth, fetchAdminMe } from "./api/client";
import { clearAdminSession, getAdminUsername, isAdminLoggedIn } from "./auth/adminSession";
import { AdminConversationFlow } from "./components/AdminConversationFlow";
import { AdminCustomers } from "./components/AdminCustomers";
import { AdminLogin } from "./components/AdminLogin";
import { AdminPanel } from "./components/AdminPanel";
import { AdminSpeechHistory } from "./components/AdminSpeechHistory";
import { getLobbyUrl } from "./utils/apiBase";
import { startVisibilityAwarePoll } from "./utils/polling";

type AdminView = "lobby" | "customers" | "speech" | "flow";

function viewFromHash(): AdminView {
  const hash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
  if (hash === "customers" || hash.startsWith("customers")) return "customers";
  if (hash === "speech" || hash === "speech-history" || hash.startsWith("speech")) return "speech";
  if (hash === "flow" || hash === "conversation-flow" || hash.startsWith("flow")) return "flow";
  if (hash === "form-submissions") return "lobby";
  return "lobby";
}

const VIEW_TITLES: Record<AdminView, { kn: string; crumb: string }> = {
  lobby: { kn: "ಲಾಬಿ ನಿಯಂತ್ರಣ", crumb: "Staff · Lobby" },
  customers: { kn: "ಗ್ರಾಹಕರು", crumb: "Staff · Customers" },
  speech: { kn: "ಮಾತು ಇತಿಹಾಸ", crumb: "Staff · Speech turns" },
  flow: { kn: "ಸಂವಾದ ಹರಿವು", crumb: "Staff · Conversation flow" },
};

/** Staff console — lobby, customers, speech history, and conversation map. */
export function AdminApp() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [adminAuthed, setAdminAuthed] = useState(() => isAdminLoggedIn());
  const [adminChecking, setAdminChecking] = useState(false);
  const [view, setView] = useState<AdminView>(() => viewFromHash());
  const username = getAdminUsername() ?? "Staff";

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let consecutiveFailures = 0;
    let hasConnected = false;
    const startupGraceUntil = Date.now() + 60_000;
    const recordHealth = (ok: boolean) => {
      if (cancelled) return;
      if (ok) {
        hasConnected = true;
        consecutiveFailures = 0;
        setConnected(true);
        return;
      }
      if (!hasConnected && Date.now() < startupGraceUntil) return;
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) setConnected(false);
    };
    const probe = () => {
      checkHealth().then((ok) => {
        if (cancelled) return;
        recordHealth(ok);
        if (!ok && attempts < 10) {
          attempts += 1;
          window.setTimeout(probe, 1500);
        }
      });
    };
    probe();
    const stop = startVisibilityAwarePoll(() => {
      checkHealth().then((ok) => {
        recordHealth(ok);
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

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (next: AdminView) => {
    const hash =
      next === "lobby"
        ? ""
        : next === "customers"
          ? "#customers"
          : next === "speech"
            ? "#speech-history"
            : "#conversation-flow";
    if (hash) window.location.hash = hash;
    else if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setView(next);
  };

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

  const titles = VIEW_TITLES[view];

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar" aria-label="Navigation">
        <div className="adm-sidebar-brand">
          <span className="adm-sidebar-logo kn" aria-hidden>
            ಕ
          </span>
          <div>
            <strong className="kn">ಕನ್ನಡ ಧ್ವನಿ ಬ್ಯಾಂಕಿಂಗ್</strong>
            <span>Voice banking</span>
          </div>
        </div>

        <p className="adm-sidebar-tag">Staff console</p>

        <nav className="adm-sidebar-nav">
          <button
            type="button"
            className={`adm-nav-item ${view === "lobby" ? "is-active" : ""}`}
            aria-current={view === "lobby" ? "page" : undefined}
            onClick={() => go("lobby")}
          >
            <svg className="adm-nav-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 13h6v7H4v-7zm10-9h6v16h-6V4zM4 4h6v5H4V4z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <span className="kn">ಲಾಬಿ ನಿಯಂತ್ರಣ</span>
              <span className="adm-nav-sub">Lobby control</span>
            </span>
          </button>
          <button
            type="button"
            className={`adm-nav-item ${view === "customers" ? "is-active" : ""}`}
            aria-current={view === "customers" ? "page" : undefined}
            onClick={() => go("customers")}
          >
            <svg className="adm-nav-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span>
              <span className="kn">ಗ್ರಾಹಕರು</span>
              <span className="adm-nav-sub">Customers & balances</span>
            </span>
          </button>
          <button
            type="button"
            className={`adm-nav-item ${view === "speech" ? "is-active" : ""}`}
            aria-current={view === "speech" ? "page" : undefined}
            onClick={() => go("speech")}
          >
            <svg className="adm-nav-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3v10a3 3 0 01-3 3H7l-3 3V8a5 5 0 015-5h3zm2 2h1a5 5 0 015 5v11l-3-3h-1a3 3 0 01-3-3V5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <span className="kn">ಮಾತು ಇತಿಹಾಸ</span>
              <span className="adm-nav-sub">Speech turns</span>
            </span>
          </button>
          <button
            type="button"
            className={`adm-nav-item ${view === "flow" ? "is-active" : ""}`}
            aria-current={view === "flow" ? "page" : undefined}
            onClick={() => go("flow")}
          >
            <svg className="adm-nav-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 6h6v4H5V6zm8 0h6v4h-6V6zM5 14h6v4H5v-4zm8 2h6M8 10v4m8-4v2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <span className="kn">ಸಂವಾದ ಹರಿವು</span>
              <span className="adm-nav-sub">Where speech goes</span>
            </span>
          </button>
          <a className="adm-nav-item" href="/#form-submissions" onClick={() => go("lobby")}>
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
            <p className="adm-topbar-crumb">{titles.crumb}</p>
            <h1 className="kn">{titles.kn}</h1>
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
          {view === "lobby" && (
            <AdminPanel
              apiOnline={connected}
              username={username}
              onOpenLobby={() => window.open(getLobbyUrl(), "_blank", "noopener,noreferrer")}
              onLogout={() => setAdminAuthed(false)}
            />
          )}
          {view === "customers" && <AdminCustomers apiOnline={connected} />}
          {view === "speech" && <AdminSpeechHistory apiOnline={connected} />}
          {view === "flow" && <AdminConversationFlow apiOnline={connected} />}
        </main>
      </div>
    </div>
  );
}
