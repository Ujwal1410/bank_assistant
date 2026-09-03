import { useCallback, useEffect, useState } from "react";
import {
  fetchSpeakKannada,
  fetchVoiceSettings,
  updateVoiceSpeaker,
  base64ToAudioUrl,
  type VoiceOption,
} from "../api/client";
import { unlockAudio } from "../utils/playAudio";

const PREVIEW_TEXT = "ನಮಸ್ಕಾರ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?";

interface AdminVoiceSettingsProps {
  apiOnline: boolean | null;
  onChanged?: (speaker: string) => void;
}

export function AdminVoiceSettings({ apiOnline, onChanged }: AdminVoiceSettingsProps) {
  const [options, setOptions] = useState<VoiceOption[]>([]);
  const [speaker, setSpeaker] = useState<string>("Suresh");
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchVoiceSettings()
      .then((data) => {
        if (cancelled) return;
        setSpeaker(data.speaker);
        setOptions(data.options);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Voice settings unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = async (id: string) => {
    if (id === speaker || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await updateVoiceSpeaker(id);
      setSpeaker(next);
      onChanged?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save voice");
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = useCallback(
    async (id: string) => {
      if (apiOnline === false) return;
      setPreviewing(id);
      setError(null);
      try {
        await unlockAudio();
        const b64 = await fetchSpeakKannada(PREVIEW_TEXT, undefined, id);
        const url = base64ToAudioUrl(b64);
        const audio = new Audio(url);
        await audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed");
      } finally {
        setPreviewing(null);
      }
    },
    [apiOnline],
  );

  if (!options.length) return null;

  return (
    <section className="adm-card adm-voice-card" aria-label="Assistant voice">
      <header className="adm-card-head">
        <div>
          <h2>Assistant voice</h2>
          <p className="kn">ಸಹಾಯಕ ಧ್ವನಿ</p>
        </div>
        <span className="adm-pill adm-pill--gold">Active · {speaker}</span>
      </header>

      <div className="adm-card-body">
        <p className="adm-card-lead">Natural Kannada voice for greetings and replies — choose Suresh or Anu.</p>

        <div className="adm-voice-tiles">
          {options.map((opt) => {
            const selected = speaker === opt.id;
            const initial = opt.id === "Anu" ? "ಅ" : "ಸ";
            return (
              <article
                key={opt.id}
                className={`adm-voice-tile ${selected ? "is-selected" : ""}`}
              >
                <button
                  type="button"
                  className="adm-voice-tile-main"
                  disabled={busy || apiOnline === false}
                  onClick={() => void handleSelect(opt.id)}
                >
                  <span className="adm-voice-avatar">{initial}</span>
                  <span className="adm-voice-tile-text">
                    <span className="adm-voice-tile-name">
                      <span className="kn">{opt.label_kn}</span>
                      <span>{opt.label_en}</span>
                    </span>
                    <span className="adm-voice-tile-desc">{opt.description_en}</span>
                  </span>
                  {selected && <span className="adm-voice-check">✓</span>}
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--ghost adm-btn--sm adm-voice-preview"
                  disabled={previewing !== null || apiOnline === false}
                  onClick={() => void handlePreview(opt.id)}
                >
                  {previewing === opt.id ? "▶ Playing" : "Preview"}
                </button>
              </article>
            );
          })}
        </div>

        {error && <p className="adm-inline-error">{error}</p>}
      </div>
    </section>
  );
}
