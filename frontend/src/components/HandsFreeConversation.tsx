import { useEffect, useRef, useState } from "react";
import {
  fetchDemoBalance,
  fetchForm,
  fetchFormPromptAudio,
  fetchFormSummary,
  fillFormFieldAudio,
  normalizeFormValue,
  processAudio,
  submitFormSubmission,
  type BankForm,
  type FormMenuItem,
  type PipelineContext,
  type PipelineResult,
  type FormField,
  type FormFillResult,
  type FormSummaryLine,
} from "../api/client";
import {
  AgentSubtitle,
  BalanceResultCard,
  FormFilledChips,
  FormSummaryPanel,
  LiveValueCard,
  PipelineProgress,
  type BalanceResultView,
} from "./LiveContextPanel";
import { useVadRecorder, type VadListenOptions } from "../hooks/useVadRecorder";
import { isAbortError, userFacingFetchError } from "../utils/abortError";
import { playBase64Wav, speakKannada, unlockAudio } from "../utils/playAudio";
import {
  ANYTHING_ELSE_KN,
  ASK_NEED_KN,
  FORM_CONFIRM_SUFFIX_KN,
  FORM_SUMMARY_CLOSER_KN,
  FORM_SUMMARY_OPENER_KN,
  FORM_WHOLE_CONFIRM_KN,
} from "../utils/lobbyPhrases";
import { displayFieldValue } from "../utils/formSummary";
import {
  isAffirmCommand,
  isEndSessionCommand,
  isRejectCommand,
  isSkipCommand,
} from "../utils/voiceCommands";

export type HandsFreeTurn =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "form_prompt"
  | "form_confirm"
  | "form_summary_confirm"
  | "form_preview";

interface HandsFreeConversationProps {
  active: boolean;
  apiOnline: boolean | null;
  skipInitialPrompt?: boolean;
  kioskSessionId?: string | null;
  onRequestEnd: (reason: string) => void;
  onTurnChange?: (turn: HandsFreeTurn) => void;
  onFormModeChange?: (inForm: boolean) => void;
}

type Mode = "assist" | "form" | "form_select";

interface FormSession {
  form: BankForm;
  fieldIndex: number;
  values: Record<string, string>;
  promptAudio: Record<string, string>;
  skipFirstFieldPrompt?: boolean;
}

function todayDateString(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function autoFilledValues(form: BankForm): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of form.fields) {
    if (field.auto === "today" || (field.type === "date" && field.id === "date")) {
      values[field.id] = todayDateString();
    }
  }
  return values;
}

function askableFields(form: BankForm) {
  return form.fields.filter((f) => !f.auto && !(f.type === "date" && f.id === "date"));
}

function statusLabel(turn: HandsFreeTurn, mode: Mode): string {
  switch (turn) {
    case "listening":
      return mode === "form"
        ? "ಕೇಳುತ್ತಿದ್ದೇನೆ… · Listening for your answer"
        : "ಕೇಳುತ್ತಿದ್ದೇನೆ… · Listening — speak in Kannada";
    case "thinking":
      return "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ… · Processing";
    case "speaking":
      return "ಉತ್ತರಿಸುತ್ತಿದ್ದೇನೆ… · Speaking";
    case "form_prompt":
      return "ಪ್ರಶ್ನೆ… · Asking next field";
    case "form_confirm":
      return "ದೃಢೀಕರಿಸಿ — ಸರಿ ಅಥವಾ ಮತ್ತೆ ಹೇಳಿ";
    case "form_summary_confirm":
      return "ಎಲ್ಲಾ ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ";
    case "form_preview":
      return "ಅರ್ಜಿ ಸಿದ್ಧ · Form ready to print";
    default:
      return mode === "form_select"
        ? "ಅರ್ಜಿ ಆಯ್ಕೆ · Pick a form"
        : "ಸಿದ್ಧ";
  }
}

const NAME_FIELD_IDS = new Set([
  "full_name",
  "name",
  "applicant_name",
  "beneficiary_name",
  "remitter_name",
  "nominee_name",
]);

function formListenOpts(field: FormField): VadListenOptions {
  if (NAME_FIELD_IDS.has(field.id) || field.type === "text") {
    return {
      silenceMs: 1300,
      minSpeechMs: 450,
      maxUtteranceMs: 22000,
      speechThreshold: 0.014,
    };
  }
  if (field.type === "digits" || field.type === "amount") {
    return { silenceMs: 1100, minSpeechMs: 400, maxUtteranceMs: 20000 };
  }
  return {};
}

function resolveFormFieldValue(filled: FormFillResult, field: FormField): string {
  let value =
    filled.value ||
    filled.english_text ||
    normalizeFormValue(filled.kannada_text, field.type, field.id);
  if (!value?.trim() && field.type === "digits") {
    value = normalizeFormValue(filled.kannada_text, "digits", field.id);
  }
  if (!value?.trim() && NAME_FIELD_IDS.has(field.id)) {
    value =
      normalizeFormValue(filled.kannada_text, "text", field.id) || filled.kannada_text.trim();
  }
  return value?.trim() ?? "";
}

export function HandsFreeConversation({
  active,
  apiOnline,
  skipInitialPrompt = false,
  kioskSessionId = null,
  onRequestEnd,
  onTurnChange,
  onFormModeChange,
}: HandsFreeConversationProps) {
  const { state: vadState, error: vadError, micLevel, listenOnce, abort, releaseMic, warmupMic } =
    useVadRecorder();

  const [turn, setTurn] = useState<HandsFreeTurn>("idle");
  const [mode, setMode] = useState<Mode>("assist");
  const [formMenuItems, setFormMenuItems] = useState<FormMenuItem[]>([]);
  const [lastResult, setLastResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [formSession, setFormSession] = useState<FormSession | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [summaryLines, setSummaryLines] = useState<FormSummaryLine[]>([]);
  const [summaryActiveIndex, setSummaryActiveIndex] = useState(-1);
  const [balanceResult, setBalanceResult] = useState<BalanceResultView | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);

  const onEndRef = useRef(onRequestEnd);
  onEndRef.current = onRequestEnd;
  const onTurnRef = useRef(onTurnChange);
  onTurnRef.current = onTurnChange;
  const onFormModeRef = useRef(onFormModeChange);
  onFormModeRef.current = onFormModeChange;
  const playAbortRef = useRef<AbortController | null>(null);
  const listenOnceRef = useRef(listenOnce);
  listenOnceRef.current = listenOnce;
  const warmupMicRef = useRef(warmupMic);
  warmupMicRef.current = warmupMic;
  const apiOnlineRef = useRef(apiOnline);
  apiOnlineRef.current = apiOnline;
  const kioskSessionRef = useRef(kioskSessionId);
  kioskSessionRef.current = kioskSessionId;
  const dialogRef = useRef<{
    last_intent: string;
    last_route: string;
    pending_intents: string[];
    clarify_attempts: number;
    last_kannada_text: string;
    last_english_text: string;
  }>({
    last_intent: "",
    last_route: "",
    pending_intents: [],
    clarify_attempts: 0,
    last_kannada_text: "",
    last_english_text: "",
  });

  useEffect(() => {
    if (apiOnline === false && active) {
      abort();
      playAbortRef.current?.abort();
      window.speechSynthesis?.cancel();
    }
  }, [apiOnline, active, abort]);

  useEffect(() => {
    if (!active || apiOnlineRef.current === false) {
      abort();
      playAbortRef.current?.abort();
      window.speechSynthesis?.cancel();
      setTurn("idle");
      return;
    }

    let cancelled = false;
    let session: FormSession | null = null;

    const still = () => !cancelled && active;

    const run = async () => {
      for (let i = 0; i < 12 && still() && apiOnlineRef.current === null; i++) {
        await new Promise((r) => window.setTimeout(r, 250));
      }
      if (!still()) return;

      await unlockAudio();
      playAbortRef.current = new AbortController();
      const micOk = await warmupMicRef.current();
      if (!micOk || !still()) {
        setError("ಮೈಕ್ ಅನುಮತಿ ಬೇಕು · Please allow microphone access");
        return;
      }

    let emptyListenCount = 0;

    const pipelineContext = (overrides: Partial<PipelineContext> = {}): PipelineContext => ({
      mode: "assist",
      last_intent: dialogRef.current.last_intent,
      last_route: dialogRef.current.last_route,
      pending_intents: dialogRef.current.pending_intents,
      clarify_attempts: dialogRef.current.clarify_attempts,
      last_kannada_text: dialogRef.current.last_kannada_text,
      last_english_text: dialogRef.current.last_english_text,
      kiosk_session_id: kioskSessionRef.current ?? undefined,
      ...overrides,
    });

    const rememberTurn = (result: PipelineResult) => {
      if (result.kannada_text) {
        dialogRef.current.last_kannada_text = result.kannada_text;
      }
      if (result.english_text) {
        dialogRef.current.last_english_text = result.english_text;
      }
      if (result.intent === "clarification") {
        dialogRef.current.last_intent = "clarification";
        dialogRef.current.pending_intents = result.clarify_candidates ?? [];
        dialogRef.current.clarify_attempts += 1;
      } else if (result.intent) {
        dialogRef.current.last_intent = result.intent;
        dialogRef.current.pending_intents = [];
        dialogRef.current.clarify_attempts = 0;
      }
      if (result.route) {
        dialogRef.current.last_route = result.route;
      }
    };

    const setSession = (next: FormSession | null) => {
      session = next;
      setFormSession(next);
      onFormModeRef.current?.(next !== null);
    };

    const playKannada = async (text: string, cachedB64?: string) => {
      playAbortRef.current?.abort();
      const ac = new AbortController();
      playAbortRef.current = ac;
      try {
        if (cachedB64) {
          setTurn("speaking");
          await playBase64Wav(cachedB64, ac.signal);
          return;
        }
        setTurn("speaking");
        await speakKannada(text, ac.signal, apiOnlineRef.current);
      } catch (err) {
        if (isAbortError(err)) return;
        throw err;
      }
    };

    const playReply = async (audioB64: string, subtitleText?: string) => {
      playAbortRef.current?.abort();
      const ac = new AbortController();
      playAbortRef.current = ac;
      setTurn("speaking");
      if (subtitleText) setSubtitle(subtitleText);
      try {
        await playBase64Wav(audioB64, ac.signal);
      } catch (err) {
        if (isAbortError(err)) return;
        throw err;
      }
    };

    const playKannadaLine = async (text: string, cachedB64?: string) => {
      setSubtitle(text);
      await playKannada(text, cachedB64);
    };

    const playFormSummary = async (summary: Awaited<ReturnType<typeof fetchFormSummary>>) => {
      setSummaryLines(summary.lines);
      setSummaryActiveIndex(-1);
      setTurn("speaking");
      setHint("ಅರ್ಜಿ ಸಾರಾಂಶ…");

      const opener = FORM_SUMMARY_OPENER_KN;
      setSubtitle(opener);
      await playKannada(opener);
      if (!still()) return;

      for (let i = 0; i < summary.lines.length; i++) {
        const line = summary.lines[i];
        const phrase = `${line.label_kn} ${line.speak_kn}.`;
        setSummaryActiveIndex(i);
        setSubtitle(phrase);
        await playKannada(phrase);
        if (!still()) return;
      }

      setSummaryActiveIndex(-1);
      const closer = FORM_SUMMARY_CLOSER_KN;
      setSubtitle(closer);
      await playKannada(closer);
    };

    const continueAssist = async () => {
      setSession(null);
      setMode("assist");
      setFormMenuItems([]);
      setSubmitWarning(null);
      setHint("ಮತ್ತೆ ಕೇಳಬಹುದು · Ask another question");
      await playKannadaLine(ANYTHING_ELSE_KN);
    };

    const openFormById = async (
      formId: string,
      opts?: { skipFirstFieldPrompt?: boolean; prefill?: Record<string, string> },
    ) => {
      const [detail, promptAudio] = await Promise.all([
        fetchForm(formId),
        fetchFormPromptAudio(formId).catch(() => ({} as Record<string, string>)),
      ]);
      if (!still()) return;
      const values = { ...autoFilledValues(detail), ...(opts?.prefill ?? {}) };
      let fieldIndex = 0;
      const askFields = askableFields(detail);
      if (opts?.prefill?.account_number && askFields[0]?.id === "account_number") {
        fieldIndex = 1;
      }
      session = {
        form: detail,
        fieldIndex,
        values,
        promptAudio,
        skipFirstFieldPrompt: opts?.skipFirstFieldPrompt ?? false,
      };
      setSession(session);
      setMode("form");
      setFormMenuItems([]);
      setBalanceResult(null);
      setHint(`ಅರ್ಜಿ: ${detail.title_kn}`);
      await runFormLoop();
      if (!still()) return;
      await continueAssist();
    };

    const runFormSelectLoop = async (items: FormMenuItem[]) => {
      setFormMenuItems(items);
      setMode("form_select");
      setHint("ಸಂಖ್ಯೆ ಅಥವಾ ಅರ್ಜಿ ಹೆಸರು ಹೇಳಿ · Say form number or name");
      const menuIds = items.map((item) => item.id);

      while (still()) {
        setTurn("listening");
        const blob = await listenOnceRef.current({ silenceMs: 1200, minSpeechMs: 400 });
        if (!still()) return;
        if (!blob) continue;

        setTurn("thinking");
        try {
          const ext = blob.type.includes("ogg") ? "ogg" : "webm";
          const result = await processAudio(blob, `pick-form.${ext}`, pipelineContext({
            mode: "form_select",
            menu_form_ids: menuIds,
          }));
          if (!still()) return;

          rememberTurn(result);

          if (result.error && !result.form_id) {
            setError(result.error);
            if (result.response_text_kn) {
              await playKannada(result.response_text_kn);
            }
            continue;
          }

          if (isEndSessionCommand(result.kannada_text, result.english_text)) {
            onEndRef.current("Customer ended during form pick");
            return;
          }

          if (result.route === "transactional" && result.form_id) {
            await openFormById(result.form_id);
            return;
          }

          setError("ಗುರುತಿಸಲಾಗಲಿಲ್ಲ — ದಯವಿಟ್ಟು ಸಂಖ್ಯೆ ಅಥವಾ ಅರ್ಜಿ ಹೆಸರು ಮತ್ತೆ ಹೇಳಿ");
          if (result.response_text_kn) {
            await playKannada(result.response_text_kn);
          } else {
            await playKannada("ದಯವಿಟ್ಟು ಸಂಖ್ಯೆ ಅಥವಾ ಅರ್ಜಿ ಹೆಸರು ಮತ್ತೆ ಹೇಳಿ");
          }
        } catch (err) {
          if (!still()) return;
          if (isAbortError(err)) return;
          setError(err instanceof Error ? err.message : "Could not pick form");
        }
      }
    };

    const runFormLoop = async () => {
      while (still()) {
        if (!session) return;

        const fields = askableFields(session.form);
        if (session.fieldIndex >= fields.length) {
          if (session.form.id === "balance_inquiry") {
            const acct = session.values.account_number?.trim();
            setTurn("thinking");
            try {
              const bal = await fetchDemoBalance(acct || "");
              setBalanceResult(bal);
              setTurn("speaking");
              setHint(bal.message_kn);
              await playKannadaLine(bal.message_kn);
            } catch (err) {
              if (isAbortError(err)) return;
              setError(err instanceof Error ? err.message : "Balance lookup failed");
            }
            setSession(null);
            setSummaryLines([]);
            return;
          }

          setTurn("thinking");
          setHint("ಅರ್ಜಿ ಸಾರಾಂಶ ತಯಾರಿಸಲಾಗುತ್ತಿದೆ…");
          try {
            const summary = await fetchFormSummary(session.form.id, session.values);
            if (!still()) return;
            await playFormSummary(summary);
            if (!still()) return;

            setTurn("form_summary_confirm");
            await playKannadaLine(summary.confirm_prompt_kn || FORM_WHOLE_CONFIRM_KN);
            if (!still()) return;

            setTurn("listening");
            setHint("ಹೌದು ಅಥವಾ ಇಲ್ಲ ಹೇಳಿ · Say yes or no");
            const confirmBlob = await listenOnceRef.current({ silenceMs: 1200, minSpeechMs: 350 });
            if (!still()) return;
            if (!confirmBlob) {
              setHint("ದಯವಿಟ್ಟು ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ");
              session = { ...session, fieldIndex: 0 };
              setSession(session);
              setSummaryLines([]);
              continue;
            }

            setTurn("thinking");
            const confirmExt = confirmBlob.type.includes("ogg") ? "ogg" : "webm";
            const confirmFill = await fillFormFieldAudio(
              confirmBlob,
              "text",
              "confirm",
              `whole-confirm.${confirmExt}`,
            );
            if (!still()) return;

            const parts = [
              confirmFill.kannada_text,
              confirmFill.english_text,
              confirmFill.value,
            ];
            if (isEndSessionCommand(...parts)) {
              onEndRef.current("Customer ended during form summary");
              return;
            }
            if (isRejectCommand(...parts)) {
              setHint("ಮತ್ತೆ ಪ್ರಾರಂಭಿಸೋಣ — ಮೊದಲ ಪ್ರಶ್ನೆಯಿಂದ");
              session = { ...session, fieldIndex: 0 };
              setSession(session);
              setSummaryLines([]);
              setDraft("");
              setError(null);
              continue;
            }
            if (!isAffirmCommand(...parts) && !parts.join(" ").trim()) {
              setHint("ದಯವಿಟ್ಟು ಹೌದು ಎಂದು ಹೇಳಿ");
              continue;
            }

            setTurn("form_preview");
            setHint("ಅರ್ಜಿ ಸಿದ್ಧ. ಪ್ರಿಂಟ್ ಮಾಡಬಹುದು.");
            setSubtitle(null);
            if (!still()) return;

            try {
              await submitFormSubmission({
                form_id: session.form.id,
                title_kn: session.form.title_kn,
                title_en: session.form.title_en,
                values: session.values,
                kiosk_session_id: kioskSessionRef.current ?? undefined,
              });
              setSubmitWarning(null);
            } catch {
              setSubmitWarning(
                "ಅರ್ಜಿ ಉಳಿಸಲಾಗಲಿಲ್ಲ — ಪ್ರಿಂಟ್ ಮಾಡಬಹುದು · Save failed, print still works",
              );
            }

            setSession(null);
            setSummaryLines([]);
            return;
          } catch (err) {
            if (isAbortError(err)) return;
            setError(err instanceof Error ? err.message : "Form summary failed");
            return;
          }
        }

        const field = fields[session.fieldIndex];
        setDraft("");
        setTurn("form_prompt");
        const skipPrompt =
          session.skipFirstFieldPrompt &&
          session.fieldIndex === 0 &&
          field.id === "account_number";
        if (!skipPrompt && field.prompt_kn) {
          setSubtitle(field.prompt_kn);
          await playKannada(field.prompt_kn, session.promptAudio[field.id]);
        }
        if (!still()) return;

        setTurn("listening");
        const blob = await listenOnceRef.current(formListenOpts(field));
        if (!still()) return;
        if (!blob) {
          setHint("ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ · Speak clearly, a little louder");
          continue;
        }

        setTurn("thinking");
        try {
          const ext = blob.type.includes("ogg") ? "ogg" : "webm";
          const filled = await fillFormFieldAudio(blob, field.type, field.id, `field.${ext}`);
          if (!still()) return;

          const skipSource = `${filled.kannada_text} ${filled.english_text} ${filled.value}`;
          if (isEndSessionCommand(filled.kannada_text, filled.english_text)) {
            onEndRef.current("Customer ended during form");
            return;
          }

          if (!field.required && isSkipCommand(skipSource)) {
            session = {
              ...session,
              fieldIndex: session.fieldIndex + 1,
              values: { ...session.values, [field.id]: "" },
            };
            setSession(session);
            continue;
          }

          const value = resolveFormFieldValue(filled, field);
          if (field.required && !value) {
            setError("ಕೇಳಲಾಗಲಿಲ್ಲ — ದಯವಿಟ್ಟು ಮತ್ತೆ ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ");
            setHint("ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಮತ್ತೆ ಹೇಳಿ · Speak your answer again, clearly");
            continue;
          }
          setDraft(value);

          // Names: skip "say yes to confirm" — it loops when STT misses "ಸರಿ"
          if (NAME_FIELD_IDS.has(field.id)) {
            session = {
              ...session,
              fieldIndex: session.fieldIndex + 1,
              values: { ...session.values, [field.id]: value },
            };
            setSession(session);
            setDraft("");
            setError(null);
            continue;
          }

          setTurn("form_confirm");

          const confirmLine = value
            ? `${value}. ${FORM_CONFIRM_SUFFIX_KN}`
            : FORM_CONFIRM_SUFFIX_KN;
          await playKannada(confirmLine);
          if (!still()) return;

          setTurn("listening");
          const confirmBlob = await listenOnceRef.current();
          if (!still()) return;
          if (!confirmBlob) continue;

          setTurn("thinking");
          const confirmExt = confirmBlob.type.includes("ogg") ? "ogg" : "webm";
          const confirmFill = await fillFormFieldAudio(
            confirmBlob,
            "text",
            "confirm",
            `confirm.${confirmExt}`,
          );
          if (!still()) return;

          const parts = [
            confirmFill.kannada_text,
            confirmFill.english_text,
            confirmFill.value,
          ];
          if (isEndSessionCommand(...parts)) {
            onEndRef.current("Customer ended during confirm");
            return;
          }
          if (isRejectCommand(...parts)) {
            continue;
          }
          const confirmText = parts.join(" ").trim();
          if (!isAffirmCommand(...parts)) {
            if (confirmText) {
              await playKannada(FORM_CONFIRM_SUFFIX_KN);
              continue;
            }
            // Short "ಸರಿ" often missed by STT — soft-accept when audio was captured
          }

          const finalValue = normalizeFormValue(value, field.type, field.id) || value;
          if (field.required && !finalValue.trim()) {
            setError("ಈ ಕ್ಷೇತ್ರ ಅಗತ್ಯ · Required field");
            continue;
          }

          session = {
            ...session,
            fieldIndex: session.fieldIndex + 1,
            values: { ...session.values, [field.id]: finalValue },
          };
          setSession(session);
          setDraft("");
        } catch (err) {
          if (!still()) return;
          if (isAbortError(err)) return;
          setError(err instanceof Error ? err.message : "Form fill failed");
        }
      }
    };

    const runAssistLoop = async () => {
      setLastResult(null);
      setError(null);
      setSession(null);
      setMode("assist");

      // After lobby greeting — skip redundant spoken prompt; show hint and listen.
      if (!skipInitialPrompt) {
        setTurn("speaking");
        setHint("ನಿಮಗೆ ಏನು ಸಹಾಯ ಬೇಕು?");
        await playKannadaLine(ASK_NEED_KN);
        if (!still()) return;
      } else {
        setTurn("listening");
        setHint("ನಿಮಗೆ ಏನು ಸಹಾಯ ಬೇಕು? · Speak your request in Kannada");
      }

      while (still()) {
        setMode("assist");
        setError(null);
        setTurn("listening");
        if (!hint?.includes("Speak")) setHint(null);

        const blob = await listenOnceRef.current();
        if (!still()) return;
        if (!blob) {
          emptyListenCount += 1;
          if (emptyListenCount >= 2) {
            setHint("ಕೇಳಲಿಲ್ಲ — ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ");
            await playKannada("ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ");
            emptyListenCount = 0;
          }
          continue;
        }
        emptyListenCount = 0;
        setBalanceResult(null);

        setTurn("thinking");
        try {
          const ext = blob.type.includes("ogg") ? "ogg" : "webm";
          const result = await processAudio(blob, `lobby.${ext}`, pipelineContext());
          if (!still()) return;

          setLastResult(result);
          rememberTurn(result);

          if (result.error) {
            const canProceed =
              Boolean(result.form_id) || Boolean(result.form_menu?.length);
            if (result.response_text_kn && !result.audio_b64) {
              try {
                await playKannadaLine(result.response_text_kn);
              } catch (playErr) {
                if (!isAbortError(playErr)) {
                  console.warn("[hands-free] TTS fallback failed:", playErr);
                }
              }
            }
            if (!canProceed) {
              setError(result.error);
              continue;
            }
          }

          if (isEndSessionCommand(result.kannada_text, result.english_text)) {
            onEndRef.current("Customer said goodbye");
            return;
          }

          if (result.route === "form_menu" && result.form_menu?.length) {
            if (result.audio_b64) {
              await playReply(result.audio_b64, result.response_text_kn);
            } else if (result.response_text_kn) {
              await playKannadaLine(result.response_text_kn);
            }
            if (!still()) return;
            await runFormSelectLoop(result.form_menu);
            continue;
          }

          if (result.route === "transactional" && result.form_id) {
            try {
              if (result.audio_b64) {
                await playReply(result.audio_b64, result.response_text_kn);
              }
              if (!still()) return;
              await openFormById(result.form_id, {
                skipFirstFieldPrompt: result.intent === "check_balance",
                prefill: result.prefill,
              });
            } catch (err) {
              if (isAbortError(err)) return;
              setError(err instanceof Error ? err.message : "Could not open form");
            }
            continue;
          }

          if (result.audio_b64) {
            await playReply(result.audio_b64, result.response_text_kn);
          } else if (result.response_text_kn) {
            await playKannadaLine(result.response_text_kn);
          }
        } catch (err) {
          if (!still()) return;
          if (isAbortError(err)) return;
          const msg = userFacingFetchError(err);
          if (msg) setError(msg);
        }
      }
    };

      await runAssistLoop();
    };

    void run();

    return () => {
      cancelled = true;
      abort();
      releaseMic();
      playAbortRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, [active, abort, releaseMic, skipInitialPrompt, kioskSessionId]);

  useEffect(() => {
    if (!active) {
      onFormModeRef.current?.(false);
    }
  }, [active]);

  useEffect(() => {
    onTurnRef.current?.(turn);
  }, [turn]);

  const micPct = Math.min(100, Math.round(micLevel * 400));
  const form = formSession?.form ?? null;
  const fieldIndex = formSession?.fieldIndex ?? 0;
  const values = formSession?.values ?? {};
  const askFields = form ? askableFields(form) : [];
  const currentField = askFields[fieldIndex] ?? null;

  return (
    <div className="handsfree-panel">
      <AgentSubtitle text={subtitle} />
      <PipelineProgress
        active={turn === "thinking"}
        mode={mode === "form" || mode === "form_select" ? "form" : "assist"}
      />

      <div className={`handsfree-status turn-${turn}`} aria-live="polite">
        <span className="handsfree-pulse" aria-hidden />
        <p className="handsfree-status-text">{statusLabel(turn, mode)}</p>
        {hint && <p className="handsfree-hint">{hint}</p>}
        {vadState === "speech" && <p className="handsfree-hint">ಮಾತನಾಡುತ್ತಿದ್ದೀರಿ…</p>}
        {turn === "listening" && (
          <div className="handsfree-mic-meter" aria-hidden>
            <div className="handsfree-mic-fill" style={{ width: `${micPct}%` }} />
          </div>
        )}
      </div>

      {(error || vadError) && <p className="api-warning">{error ?? vadError}</p>}
      {submitWarning && <p className="api-warning api-warning--soft">{submitWarning}</p>}

      {balanceResult && <BalanceResultCard result={balanceResult} />}

      {mode === "assist" && lastResult?.response_text_kn && (
        <section className="handsfree-result panel">
          <p className="response-text-kn">{lastResult.response_text_kn}</p>
          {lastResult.route === "transactional" && lastResult.form_id && (
            <p className="handsfree-hint">ಅರ್ಜಿ ತೆರೆಯಲಾಗುತ್ತಿದೆ… · Opening form</p>
          )}
        </section>
      )}

      {mode === "form_select" && formMenuItems.length > 0 && (
        <section className="handsfree-form panel">
          <h2>ಅರ್ಜಿ ಆಯ್ಕೆ · Choose a form</h2>
          <ol className="form-menu-list">
            {formMenuItems.map((item) => (
              <li key={item.id}>
                <strong>{item.index}.</strong> {item.title_kn}
                <span className="muted"> · {item.title_en}</span>
              </li>
            ))}
          </ol>
          <p className="handsfree-hint">ಸಂಖ್ಯೆ ಅಥವಾ ಹೆಸರು ಹೇಳಿ · Say the number or form name</p>
        </section>
      )}

      {mode === "form" && form && (
        <section className="handsfree-form panel">
          <h2>{form.title_kn}</h2>
          <p className="muted">{form.title_en}</p>

          {(turn === "form_summary_confirm" || summaryLines.length > 0) && turn !== "form_preview" && (
            <FormSummaryPanel lines={summaryLines} activeIndex={summaryActiveIndex} />
          )}

          {turn !== "form_preview" && currentField && (
            <>
              <p className="form-step-label">
                {fieldIndex + 1} / {askFields.length} · {currentField.label_kn}
              </p>
              <p className="form-prompt">{currentField.prompt_kn}</p>
              {(turn === "form_confirm" || draft) && (
                <LiveValueCard
                  label={currentField.label_kn}
                  value={draft}
                  fieldType={currentField.type}
                  fieldId={currentField.id}
                />
              )}
            </>
          )}

          <FormFilledChips
            fields={askFields}
            values={values}
            currentFieldId={currentField?.id}
          />

          {turn === "form_preview" && (
            <article className="bank-form-sheet" id="bank-form-print">
              <div className="bank-form-sheet-header">
                <p className="bank-form-bank">Banking Services</p>
                <h2>{form.title_en}</h2>
              </div>
              <dl className="bank-form-fields">
                {form.fields.map((f) => (
                  <div key={f.id} className="bank-form-row">
                    <dt>{f.label_en}</dt>
                    <dd>
                      {values[f.id]?.trim()
                        ? displayFieldValue(f.id, f.type, values[f.id])
                        : "—"}
                    </dd>
                  </div>
                ))}
              </dl>
              {(form.disclaimer_kn || form.disclaimer_en) && (
                <footer className="bank-form-disclaimer-block">
                  {form.disclaimer_kn && (
                    <p className="bank-form-disclaimer kn">{form.disclaimer_kn}</p>
                  )}
                  {form.disclaimer_en && (
                    <p className="bank-form-disclaimer en">{form.disclaimer_en}</p>
                  )}
                </footer>
              )}
              <div className="form-preview-actions no-print">
                <button type="button" className="primary-btn" onClick={() => window.print()}>
                  Print / Save PDF
                </button>
              </div>
            </article>
          )}
        </section>
      )}

      <p className="handsfree-footer muted" aria-hidden>
        ಹಸ್ತರಹಿತ · Hands-free · ಹೇಳಿ &quot;ಮುಗಿಸು&quot; to end
      </p>
    </div>
  );
}
