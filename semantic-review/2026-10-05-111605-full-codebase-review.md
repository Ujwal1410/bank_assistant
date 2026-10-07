# Kannada Voice Banking Assistant — Full Codebase Review

This is a final-year engineering project building a voice-activated banking kiosk for Kannada speakers. The system takes Kannada speech, runs it through a four-stage ML pipeline (STT → translation → NLU → TTS), routes to either an informational answer or a voice-driven form, and plays back a natural Kannada response. It targets low-literacy rural bank customers who speak only Kannada.

**Watch for:** (1) 301 training examples across 7 classes is borderline-too-small for a fine-tuned DistilBERT — the model is likely overfitting, and this is the most important quality risk; (2) the admin password defaults to `bank@123` in code and sessions are stored in a process-local dict that evaporates on restart; (3) the CORS regex allows all `*.sarastralabs.com` subdomains and all private-LAN IPs without credential validation — any device on the kiosk LAN can call every API endpoint; (4) the `account_info_query` intent maps 49 different banking procedures to a single generic response because entity extraction is out of scope — customers asking "how do I block my ATM card" get the same generic text as "what is the minimum balance"; (5) there are essentially no automated unit or integration tests — only a manual run-script.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The pipeline architecture is genuinely clever for the hardware constraints. Loading each model, running inference, then explicitly unloading before the next stage loads keeps peak VRAM at single-model level on a GPU that wouldn't otherwise fit Whisper + IndicTrans2 + DistilBERT + Parler simultaneously. The warm-worker pattern — a long-lived subprocess communicating over stdin/stdout JSON — avoids the 5–10 second cold-load penalty on every request at the cost of coupling two processes through a text protocol with no schema.

The NLU training data is the most consequential technical risk. 301 examples trained on a small domain with neat, clean English sentences may perform well on clean translations but is fragile against real noisy STT output. The layered resolution (Kannada keywords → English keywords → DistilBERT) is a sensible hedge that reduces dependence on the fine-tuned model, but the model is still the final arbiter when keyword matching fails.

The admin auth system is single-node in-memory token storage with a hardcoded fallback password. For a demo kiosk in a controlled bank environment this is probably fine, but the defaults `admin`/`bank@123` in source code are a credential leak waiting to happen if the repo is shared.

The CORS policy's LAN-IP regex admits any device on any `192.168.x.x` / `10.x.x.x` / `172.16–31.x.x` network, which at a bank counter means any phone on the bank's guest WiFi can reach the full API including `/api/balance/{account_number}` with no authentication.

The frontend `HandsFreeConversation` component is the most complex piece of client code and does the most work well — it manages a conversation state machine across mic permission, VAD, TTS, form fill, and session lifecycle in a single `useEffect` loop. This is impressive for a student project. The tradeoff is that the entire conversation logic lives in one ~900-line component, making it hard to test in isolation.

The test coverage gap is significant. There is one manual pipeline runner (`test_pipeline.py`), a deployment checker, and a smoke test script. There are no pytest unit tests, no mock-based API tests, no NLU evaluation harness beyond the training log CSV.

---

<details>
<summary>Issues (11)</summary>

1. **Training data size** — 301 examples / 7 classes is at the lower bound for reliable fine-tuning. Run `evaluate.py` with a held-out test split; if test accuracy is >5 points below val accuracy the model is overfitting. Augment data or add regularization.

2. **Hardcoded fallback credentials** — `admin_auth.py` falls back to `admin`/`bank@123` when env vars are unset. The `.env.example` prompts a change but code-level fallback means a misconfigured deployment silently uses the weak password. Remove the code-level fallback; raise an error if vars are missing.

3. **In-process session store** — `_sessions` in `admin_auth.py` and `KioskState` in `kiosk_state.py` are process-local. Server restart clears all admin sessions and kiosk state. At minimum document this; for production use a persistent store or at least log a loud warning on startup.

4. **Unauthenticated balance endpoint** — `GET /api/balance/{account_number}` has no auth guard. Any device on the LAN (matched by the CORS regex) can enumerate balances. Add a kiosk session token check or rate-limiting at minimum.

5. **CORS LAN-wildcard + credentials** — `allow_credentials: True` combined with the private-IP regex means the browser will send cookies/auth headers to any server on the LAN. This is a cross-origin credential leak boundary. Restrict to specific known origins for the production kiosk.

6. **`account_info_query` generic fallback** — 49 training examples covering ATM block, PIN change, name change, IFSC lookup, and 45 other procedures all route to a single generic response. Customers asking specific procedural questions get unhelpful answers. Either split into sub-intents or implement keyword-to-procedure routing more aggressively than the current `match_account_procedure` helper.

7. **Postgres mode is a stub** — `store_mode() == "postgres"` falls through to JSON demo data with a print statement. Any operator who sets `BANK_CUSTOMER_STORE=postgres` believing they are using a real database gets silently wrong data. Either wire it up or make it raise a clear error.

8. **No automated tests** — `test_pipeline.py` is a manual integration runner, not a pytest suite. NLU accuracy, STT WER, translation BLEU, and API contract tests do not exist as automated checks. This means regressions are invisible until manual re-run.

9. **Pipeline worker stdin/stdout coupling** — the JSON-over-subprocess protocol has no framing or schema. If a model prints unexpected multi-line JSON or a debug statement that looks like `{...}`, `_read_json_line` may silently parse the wrong object. The current "skip lines that don't start with `{`" heuristic is fragile.

10. **`HandsFreeConversation` monolith** — ~900 lines of conversation logic, form management, TTS, VAD, and error handling in one component. Hard to test, hard to reason about concurrent state updates. `dialogRef` is mutated directly as a side-effect inside the main `useEffect` loop alongside `setTurn` calls, creating race-condition opportunities if React ever batches these differently.

11. **No rate limiting on audio endpoints** — `/api/process-audio` and `/api/forms/fill-field` run ML inference. A client that hammers them will queue work inside FastAPI's thread pool with no back-pressure. Add a concurrency limit (e.g. a semaphore, or uvicorn's `--limit-concurrency`) before any public demo.

</details>

---

<details>
<summary>Details</summary>

## Four-stage pipeline and memory architecture

The global lock in `pipeline_bridge._request()` serializes all pipeline requests under the process-wide `_lock`. For a single-kiosk deployment that's fine. For any multi-terminal use it becomes a queue. If the warm worker dies mid-request, `process_wav` restarts it synchronously in the HTTP path — the client hangs for the 5–10 second cold-load with no visible indication.

The oneshot subprocess fallback (`oneshot_process`) is too slow to be invisible: cold-loading all models takes 15–30 seconds. It exists for fallback correctness, not performance.

```
Agent browser
    → POST /api/process-audio
        → pipeline_bridge._request()          [locked]
            → worker subprocess stdin JSON
                → run_pipeline.py
                    STT  → unload
                    Trans → unload
                    NLU  → unload
                    TTS  → unload
            ← result JSON stdout
        ← dict
    ← HTTP 200
```

## NLU training data and the noisy-translation gap

301 examples / 7 classes gives ~43 examples per class. DistilBERT fine-tuning typically needs 100–500 per class for reliable generalization on held-out data. The training script is correctly written. Small data is the constraint.

The keyword baseline classifier's confidence formula — `match_count / len(keyword_list)` — means a query matching 1 of 5 keywords scores 0.20, below the `BANK_NLU_MIN_CONF=0.35` threshold. The keyword baseline therefore drops through to DistilBERT more often than the three-layer architecture implies; DistilBERT is carrying more weight than the design diagram suggests.

All 301 training examples are clean, grammatically correct English sentences. Real pipeline input is machine-translated Kannada speech. IndicTrans2 introduces dropped articles, reordered clauses, and code-switching artifacts. The model has never been trained on "I want to check account how much balance is" (a plausible IndicTrans2 output). Accuracy on real speech will be lower than the training log reports.

## The `account_info_query` coverage gap

This is the most visible functional problem a real customer would hit. The intent covers 49 training examples spanning ATM blocking, PIN reset, name change, IFSC lookup, cheque book request, address update, internet banking activation, and more. The decision router's `_build_account_info_response()` has a keyword-based procedure match (`match_account_procedure`) but falls back to `_BANK_INFO["account_procedures"]["general"]` for anything it can't match.

A customer asking "how do I block my ATM card" gets a generic "For any account procedure, please visit the branch or contact our helpline" response rather than specific steps. At a bank kiosk the customer's primary alternative is the teller — but this is exactly the queue the kiosk is supposed to reduce. The router's own docstring acknowledges this and defers to a future NER module. That future module doesn't exist. For the project demo this is a known gap; for real deployment it's the biggest UX failure.

## Admin auth — credential fallback and no brute-force protection

```python
password = os.environ.get("BANK_ADMIN_PASS", "bank@123").strip() or "bank@123"
```

The double fallback means setting `BANK_ADMIN_PASS=` (blank) in `.env` silently reverts to the weak password. The `.env.example` instructs users to change this, but code-level fallbacks are how production deployments end up with weak credentials. The fix is to raise an error when the env var is missing or blank, not to supply a default.

There is no brute-force protection on `/api/admin/login`. Unlimited attempts are accepted.

## CORS and the unauthenticated balance endpoint

The CORS regex allows `192.168.x.x`, `10.x.x.x`, `172.16–31.x.x`, `*.ngrok-free.app`, `*.ngrok.io`, `*.trycloudflare.com`, and `*.sarastralabs.com` — all with `allow_credentials: True`. In a bank branch environment, the same IP range that serves the kiosk also serves the bank's internal network, guest WiFi, and potentially customer devices. The `allow_credentials: True` setting means browsers will attach cookies/authorization headers to cross-origin requests from any of these origins.

`GET /api/balance/{account_number}` is completely unauthenticated. It normalizes the input (strips non-digits) and returns the account holder's name, balance, and account type. An attacker on the same LAN who knows or guesses a 10-digit account number retrieves real financial data with a plain HTTP GET. For a demo with synthetic data this is cosmetic. For a real deployment with `BANK_CUSTOMER_STORE=sqlite` seeded from real data, this is a data exposure risk.

## Postgres mode stub

`customers.py` has three store modes: `json` (demo file), `sqlite` (local production-shaped DB), and `postgres`. The postgres branch:

```python
if mode == "postgres":
    print("[customers] postgres mode requested but driver/wiring uses json fallback ...")
    return _record_from_demo(acct)
```

It prints a warning and returns demo data. Any operator who sets `BANK_CUSTOMER_STORE=postgres` believing they configured a real database silently gets the demo accounts. This is a silent correctness failure, not a recoverable error.

## Pipeline worker communication protocol

The stdin/stdout JSON protocol has a specific failure mode: `_read_json_line` reads lines sequentially and skips anything that doesn't start with `{`. If the worker process writes a multi-line exception traceback that happens to include a line starting with `{` (Python f-string error messages sometimes do this), the bridge will parse that fragment as the response. The `_request` function has a retry-on-BrokenPipe but not a retry on JSON parse error. A malformed response raises `json.JSONDecodeError` which propagates as a 500 to the client.

The `process_wav` wrapper does have a stop-and-restart pattern on `RuntimeError`:

```python
except RuntimeError:
    stop_worker()
    resp = _request(payload)
```

This is correct for dead-worker recovery but it restarts the worker (5–10 second cold load) synchronously in the request path, hanging the HTTP response. The frontend has no indication of why the response is slow.

## Frontend HandsFreeConversation and state management

The entire conversation loop runs inside a single `useEffect(() => { ... run() ... }, [active])`. The `run` async function contains nested async loops (`runAssistLoop`, `runFormLoop`, `runFormSelectLoop`) that manage all state transitions. Cancellation is handled via a `cancelled` boolean checked with `still()`. This pattern works but has hazards:

- `dialogRef` is mutated directly (`dialogRef.current.last_intent = ...`) inside the async loop. React state updates (`setTurn`, `setMode`, `setFormSession`) are queued through React's scheduler while the ref mutations are immediate. If the loop interleaves with a React re-render that checks both, it could see inconsistent state between what the ref says and what state says.
- `playAbortRef` is a shared `AbortController` that gets reassigned mid-loop. If two code paths call `playKannada` concurrently (which shouldn't happen in the sequential loop but could happen if a React lifecycle event fires), the old controller is aborted before its audio finishes.
- The `still()` guard prevents post-unmount state updates, which is correct. But the guard is checked after every `await` — any gap between an `await` resolving and the `still()` check is a window where cancelled state can still run.

For a student project this is defensible. For a kiosk that must run reliably for hours, this architecture will produce subtle bugs under unusual timing conditions (slow network, TTS timeout, mic permission delay).

## Test coverage

`test_pipeline.py` is a script that runs 11 audio clips and prints results. It requires real audio files, real models, and a GPU. It has no assertions — a wrong intent or wrong response passes silently unless a human reads the output.

There are no tests for:
- NLU accuracy on a held-out test split (there is a `evaluate.py` referenced but not present in the repo tree visible here)
- STT WER against the `stt_test_audio/transcripts.json` ground truth
- Translation BLEU on any benchmark
- API endpoint behavior (status codes, response shapes, auth rejection)
- Form validation logic
- The pipeline bridge's JSON parsing under malformed worker output
- Kiosk state machine transitions
- Frontend component behavior in any state

The deployment checker (`deployment_check.py`) and smoke test (`production_smoke_test.py`) are operational tools, not regression tests. They don't run in CI.

## ML model choices

**STT: vasista22/whisper-kannada-medium** — a Kannada-specialized Whisper fine-tune. Beam size 1 for real-time and beam size 5 for benchmarks is the right tradeoff. The two-tier fallback (VAANI → generic Whisper-medium) is well-thought-out.

**Translation: ai4bharat/indictrans2-indic-en-dist-200M** — the right model for offline Kannada↔English. The 200M distilled variant is the appropriate VRAM tradeoff.

**NLU: distilbert-base-uncased** fine-tuned on English translations. Carries the training-data-size risk above.

**TTS: AI4Bharat Indic Parler-TTS** — better choice than MMS-TTS for naturalness. The isolated `.venv-parler` to sidestep the `transformers==4.46.1` pin conflict is a pragmatic engineering decision. The remote TTS bridge (separate GPU box over HTTPS) is the right solution to VRAM contention — translating on the kiosk CPU while synthesizing on the TTS box GPU removes the biggest latency bottleneck.

## Code quality

The code is well-organized for a student project. Module APIs have clear docstrings, `__all__` exports, and consistent lazy-load/singleton-cache patterns. Error messages are actionable. The `_maybe_unload` helper in `pipeline.py` is readable. The `_DEFAULTS` dict in `train.py` makes CLI defaults visible.

Two structural weaknesses worth fixing before a viva or a real deployment:

`pipeline.py`'s NLU/Router stage block is ~120 lines inside a single `try`, handling six distinct routing cases in nested `if not routed` guards. It should be extracted to a `_resolve_routing()` function — as written it is the hardest block in the codebase to read and to unit test.

`balance.py`'s route has no auth. The rest of the codebase uses `Depends(admin_auth.require_admin)` for privileged routes consistently. The balance endpoint breaks that pattern and is the only unauthenticated data-exposure surface.

</details>

---

<details>
<summary>File map</summary>

| File | What changed / what it does |
|---|---|
| `backend/pipeline.py` | Four-stage sequential pipeline orchestrator; memory management via explicit unload |
| `backend/pipeline_bridge.py` | Warm-worker subprocess bridge; stdin/stdout JSON protocol |
| `backend/stt/__init__.py` | Whisper STT public API; lazy load + singleton cache |
| `backend/translation/__init__.py` | IndicTrans2 Kn↔En public API; lazy load + singleton cache |
| `backend/nlu/__init__.py` | DistilBERT / keyword classifier public API |
| `backend/nlu/train.py` | DistilBERT fine-tuning; early stopping, best checkpoint, CSV log |
| `backend/nlu/distilbert_classifier.py` | Inference wrapper; batch and top-k methods |
| `backend/nlu/keyword_classifier.py` | Rule-based baseline; no training required |
| `backend/nlu/resolve.py` | Three-layer resolution: Kannada keywords → English keywords → DistilBERT |
| `backend/decision_router/router.py` | Intent-to-route mapping; reads bank_info.json |
| `backend/tts/__init__.py` | TTS public API; Parler remote → local Parler → MMS fallback chain |
| `backend/db/customers.py` | Customer/account repository; json/sqlite/postgres modes |
| `backend/db/store.py` | Pipeline history persistence; MongoDB → SQLite fallback |
| `backend/balance_lookup.py` | Account number validation + balance message formatting |
| `backend/admin_flow.py` | Admin conversation-flow map builder (read-only, no side effects) |
| `backend/forms/__init__.py` | Voice form field extraction public API |
| `api/main.py` | FastAPI app; startup warmup, shutdown cleanup |
| `api/admin_auth.py` | In-memory token auth; login/logout/verify |
| `api/cors_config.py` | CORS origins list and LAN/tunnel regex |
| `api/app_settings.py` | Runtime TTS speaker setting; thread-safe, persisted to JSON |
| `api/kiosk_state.py` | In-memory kiosk phase/session state machine |
| `api/routes/pipeline.py` | `/api/process-audio`, `/api/transcribe-audio`, `/api/speak-kannada` |
| `api/routes/balance.py` | `/api/balance/{account_number}` — unauthenticated |
| `api/routes/admin.py` | Admin login/logout/customers/history/voice settings |
| `api/routes/kiosk.py` | Kiosk start/stop/presence/phase/session/greeting-audio |
| `api/routes/forms.py` | Form catalog, fill-field, submit, summary, prompt-audio |
| `frontend/src/App.tsx` | Root; API health polling with grace period |
| `frontend/src/components/AgentLobby.tsx` | Kiosk lobby; presence detection, greeting flow, session management |
| `frontend/src/components/HandsFreeConversation.tsx` | Main conversation loop; ~900 lines, handles assist/form/form-select modes |
| `frontend/src/utils/playAudio.ts` | Audio unlock, base64 WAV playback, browser TTS fallback |
| `data/nlu_training_data.json` | 301 training examples; 42–49 per class |
| `requirements.txt` | Open-range pins; no lock file |
| `.env.example` | Template with `BANK_ADMIN_PASS=CHANGE_ME` — good |
| `test_pipeline.py` | Manual integration runner; no assertions |
| `scripts/deployment_check.py` | Deployment verification tool; not a test suite |

Full diff: entire codebase (initial review, no prior baseline).

</details>
