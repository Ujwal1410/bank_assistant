# What to Speak — Kannada Voice Banking Guide

**Audience:** Demo staff, testers, juniors running the kiosk  
**Agent URL:** `https://127.0.0.1:5173` (or `https://<kiosk-ip>:5173` on same Wi‑Fi)  
**Admin URL:** `https://127.0.0.1:5174` — Customers, Speech turns, Conversation flow  
**Language:** Speak **Kannada** clearly; **English** also works for most intents (STT translates internally).

> **Demo only** — no real money moves. Forms are sample branch slips, not official bank documents.  
> On the agent screen, open **ಹೇಗೆ ಮಾತನಾಡುವುದು · How to speak** for the same tips + demo accounts.

---

## Quick start

1. Admin opens counter → customer steps into camera frame (or taps **Start**).
2. Greeting text appears on screen first, then voice plays — **wait** (do not speak yet).
3. Status goes **Preparing** (mic / voice) → then **green Listening** → **now speak**.
4. One short request in Kannada. For balance, then give all **10** account digits (including final **zero**).
5. Confirm each form value with **ಹೌದು** / **ಸರಿ**; fix with **ಮತ್ತೆ ಹೇಳಿ** / **ಇಲ್ಲ**.
6. Say **ಮುಗಿಸು** or tap **End** to finish.

### Screen status (wait vs speak)

| UI status | What it means | What you do |
|-----------|---------------|-------------|
| Preparing / Mic warming | Mic or TTS still getting ready | **Wait — do not speak** |
| Agent speaking | Bot is talking; subtitle shows the text | **Listen** |
| Green **Listening** | Ready for your turn | **Speak now** |
| Processing / Thinking | STT + NLU running | Wait |

**Tips**

- Tap the screen once if no sound (browser audio unlock).
- Wait until the bot **stops speaking** and status is green Listening before you talk.
- Speak **slowly and clearly**; for account numbers, say **one digit at a time**, pause between digits.
- Must say **all 10 digits** — missing the last `0` fails (e.g. `123456789` ≠ `1234567890`).
- Stand within the camera frame during the session.

---

## 1. Control commands (use anytime)

These work during conversation, form filling, and confirmation.

### Confirm — value is correct

| Kannada | English |
|---------|---------|
| ಸರಿ | yes |
| ಸರಿಯೇ | yes |
| ಹೌದು | yes |
| ಒಪ್ಪಿದೆ | agreed |
| ದೃಢೀಕರಿಸಿ | confirm |

Also: `ok`, `okay`, `correct`, `right`, `yeah`, `yep`

### Reject — say again

| Kannada | English |
|---------|---------|
| ಮತ್ತೆ ಹೇಳಿ | say again |
| ಮತ್ತೆ | again |
| ತಪ್ಪು | wrong |
| ಇಲ್ಲ | no |

Also: `wrong`, `no`, `repeat`, `again`

### Skip optional field

| Kannada | English |
|---------|---------|
| ಬಿಟ್ಟುಬಿಡಿ | skip |
| ಬಿಟ್ಟುಬಿಡು | skip |

Also: `skip`, `none`, `no need`, `leave it`

### End session

| Kannada | English |
|---------|---------|
| ಮುಗಿಸು | finish |
| ಮುಗಿಸಿ | finish |
| ನಿಲ್ಲಿಸು | stop |
| ಮುಗಿದು | done |

Also: `stop`, `end`, `bye`, `goodbye`, `finish`, `thank you bye`

---

## 2. Main banking requests (7 intents)

Say any phrase below after the agent is in **Listening** (greeting already asked how to help).

### A. Check balance → opens balance form

| Say in Kannada | Say in English |
|----------------|----------------|
| ನನ್ನ ಖಾತೆ ಬ್ಯಾಲೆನ್ಸ್ ಹೇಳಿ | Tell me my account balance |
| ನನ್ನ ಖಾತೆಯ ಬಾಕಿ ಎಷ್ಟು? | What is my account balance? |
| ಬಾಕಿ ತಿಳಿಸಿ | Tell me my balance |
| ಖಾತೆ ಬಾಕಿ ಪರಿಶೀಲಿಸಿ | Check my account balance |
| ಬ್ಯಾಲೆನ್ಸ್ ಎಷ್ಟು? | What is the balance? |

**What happens:** Agent asks for **10-digit account number** → you speak it → confirm → speaks balance in Kannada (digits spoken as Kannada words).

---

### B. Withdraw money → cash withdrawal slip

| Say in Kannada | Say in English |
|----------------|----------------|
| ಹಣ ಹಿಂಪಡೆಯಬೇಕು | I want to withdraw money |
| ನಗದು ಹಿಂಪಡೆಯಲು ಬೇಕು | I need to withdraw cash |
| ಹಿಂಪಡೆಯುವ ಸ್ಲಿಪ್ ಬೇಕು | Cash withdrawal slip |

Also: `withdraw`, `withdrawal`, `cash withdrawal`, `take cash`

**Fields asked:** Name → Account number → Amount → (date auto) → Purpose (optional)

---

### C. Deposit money → deposit slip

| Say in Kannada | Say in English |
|----------------|----------------|
| ಹಣ ಜಮಾ ಮಾಡಬೇಕು | I want to deposit money |
| ನಗದು ಠೇವಣಿ ಮಾಡಬೇಕು | I need to deposit cash |
| ಠೇವಣಿ ಸ್ಲಿಪ್ ಬೇಕು | Deposit slip |

Also: `deposit`, `cash deposit`, `deposit money`

**Fields asked:** Name → Account → Amount → Deposit mode (cash/cheque) → (date auto)

---

### D. Open account → account opening form

| Say in Kannada | Say in English |
|----------------|----------------|
| ಹೊಸ ಖಾತೆ ತೆರೆಯಬೇಕು | I want to open a new account |
| ಸೇವಿಂಗ್ಸ್ ಅಕೌಂಟ್ ತೆರೆಯುವುದು ಹೇಗೆ | How do I open a savings account |
| ಸೇವಿಂಗ್ಸ್ ಖಾತೆ ಬೇಕು | I want a savings account |

Also: `open account`, `new account`, `savings account`, `current account`

**Fields asked:** Full name → Date of birth → Address → Mobile → PAN → Account type → (date auto)

---

### E. Apply for loan → loan application

| Say in Kannada | Say in English |
|----------------|----------------|
| ಸಾಲಕ್ಕೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಬೇಕು | I want to apply for a loan |
| ಲೋನ್ ಬೇಕು | I need a loan |
| ವೈಯಕ್ತಿಕ ಸಾಲ ಬೇಕು | I want a personal loan |
| ಮನೆ ಸಾಲ ಬೇಕು | I need a home loan |

Also: `loan`, `apply loan`, `personal loan`, `home loan`, `agriculture loan`

**Fields asked:** Name → Mobile → Loan type → Loan amount → Income → (date auto)

---

### F. Interest rates (informational — no form)

| Say in Kannada | Say in English |
|----------------|----------------|
| ಬಡ್ಡಿ ದರ ಎಷ್ಟು? | What is the interest rate? |
| ಸೇವಿಂಗ್ಸ್ ಖಾತೆಗೆ ಎಷ್ಟು ಬಡ್ಡಿ? | Savings account interest rate? |
| FD ಬಡ್ಡಿ ದರ ತಿಳಿಸಿ | Fixed deposit interest rate? |
| ಸಾಲದ ಬಡ್ಡಿ ಎಷ್ಟು? | What is the loan interest rate? |

Also: `interest rate`, `FD rate`, `loan rate`, `EMI`

**What happens:** Agent **speaks** rates from demo data — no form.

---

### G. Account information (informational — no form)

| Say in Kannada | Say in English |
|----------------|----------------|
| ಖಾತೆ ಮಾಹಿತಿ ಬೇಕು | I need account information |
| ATM ಕಾರ್ಡ್ ಬ್ಲಾಕ್ ಮಾಡಬೇಕು | I need to block my ATM card |
| ಪಾಸ್‌ಬುಕ್ ಬೇಕು | I need passbook information |
| IFSC ಕೋಡ್ ತಿಳಿಸಿ | What is the IFSC code? |
| ಖಾತೆ ತೆರೆಯಲು ಯಾವ ದಾಖಲೆ ಬೇಕು? | What documents to open account? |

Also: `bank timings`, `statement`, `cheque book`, `internet banking`, `branch`, `PIN`

**What happens:** Agent **speaks** general procedure text (demo).

---

## 3. Form menu (pick from list)

If you want to see or choose from available forms:

| Say in Kannada | Say in English |
|----------------|----------------|
| ಅರ್ಜಿ ತುಂಬಬೇಕು | I want to fill a form |
| ಯಾವ ಅರ್ಜಿಗಳು ಲಭ್ಯ? | What forms are available? |
| ಫಾರ್ಮ್ ಬೇಕು | I need a form |
| ಚೆಕ್‌ಬುಕ್ ಅರ್ಜಿ | Cheque book form |

Also: `fill form`, `form menu`, `list forms`, `application form`

**Then say the number or name:**

| Say | Opens |
|-----|-------|
| ಒಂದು / one / 1 | 1st form in the list |
| ಎರಡು / two / 2 | 2nd form |
| ಮೂರು / three / 3 | 3rd form |
| … up to 10 | … |
| withdraw / ಹಿಂಪಡೆ | Cash withdrawal |
| deposit / ಠೇವಣಿ | Cash deposit |
| loan / ಸಾಲ | Loan application |
| RTGS / NEFT / transfer | Fund transfer form |
| cheque book | Cheque book request |
| ATM card / debit card | ATM/debit card form |
| fixed deposit / FD | Fixed deposit form |
| mobile update | Mobile number change |
| stop cheque | Stop cheque request |

Staff can also open **Admin → Conversation flow** to see intent → form → field questions.

---

## 4. All forms — what the agent will ask

For each form, the agent speaks the field prompt. Answer in voice; confirm with **ಸರಿ** / **ಹೌದು**.

### 4.1 Balance inquiry

| Field | Agent asks (Kannada) | You say |
|-------|----------------------|---------|
| Account number | ದಯವಿಟ್ಟು ನಿಮ್ಮ ಖಾತೆ ಸಂಖ್ಯೆಯನ್ನು ಹೇಳಿ | Demo account (§5) — **10 digits**, one by one |

### 4.2 Cash withdrawal

| Field | You say (example) |
|-------|-------------------|
| Name | ರಾಮೇಶ್ ಕುಮಾರ್ |
| Account | 1234567890 (digit by digit) |
| Amount | ಐದು ಸಾವಿರ / 5000 |
| Purpose (optional) | ವೈಯಕ್ತಿಕ ಬಳಕೆ — or **ಬಿಟ್ಟುಬಿಡಿ** |

Date is filled automatically (today).

### 4.3 Cash / cheque deposit

| Field | You say (example) |
|-------|-------------------|
| Name | ರಾಮೇಶ್ ಕುಮಾರ್ |
| Account | 1234567890 |
| Amount | ಮೂರು ಸಾವಿರ / 3000 |
| Deposit mode | ನಗದು or ಚೆಕ್ |

### 4.4 Open account

| Field | You say (example) |
|-------|-------------------|
| Full name | ನಿಮ್ಮ ಹೆಸರು |
| Date of birth | 15 ಜೂನ್ 1990 |
| Address | ನಿಮ್ಮ ವಿಳಾಸ |
| Mobile | 9876543210 |
| PAN | ABCDE1234F |
| Account type | ಸೇವಿಂಗ್ಸ್ |

### 4.5 Loan application

| Field | You say (example) |
|-------|-------------------|
| Name | ನಿಮ್ಮ ಹೆಸರು |
| Mobile | 9876543210 |
| Loan type | ವೈಯಕ್ತಿಕ ಸಾಲ / home loan |
| Loan amount | ಐದು ಲಕ್ಷ |
| Income | ನಲ್ವತ್ತು ಸಾವಿರ |

### 4.6–4.11 Other forms (via form menu)

RTGS/NEFT, cheque book, ATM/debit card, FD, mobile update, stop cheque — follow on-screen prompts; optional fields can be skipped with **ಬಿಟ್ಟುಬಿಡಿ**.

---

## 5. Demo account numbers (balance only)

**Only these 10-digit accounts return a balance** (`data/demo_accounts.json` / sqlite customer store). Any other number → “account not found” in Kannada.

| Account number | Name (Kannada) | Name (EN) | Balance (₹) | Type |
|----------------|----------------|-----------|-------------|------|
| **1234567890** | ರಾಮೇಶ್ ಕುಮಾರ್ | Ramesh Kumar | 45,230.50 | Savings |
| **9876543210** | ಅನಿತಾ ರಾವ್ | Anita Rao | 12,500.00 | Savings |
| **1111222233** | ಸುರೇಶ್ ಗೌಡ | Suresh Gowda | 89,340.75 | Current |
| **2222333344** | ಲಕ್ಷ್ಮಿ ದೇವಿ | Lakshmi Devi | 67,890.25 | Savings |
| **5555666677** | ಪ್ರಕಾಶ್ ಶೆಟ್ಟಿ | Prakash Shetty | 15,250.00 | Savings |
| **8888999900** | ಮೀನಾ ಪಾಟೀಲ್ | Meena Patil | 2,40,075.50 | Current |

Admin → **Customers** shows the same list + balance lookup audit.

### How to speak account numbers

**Best:** One digit at a time, pause between each. Include the **final zero**.

**Kannada (for 1234567890):**
```
ಒಂದು · ಎರಡು · ಮೂರು · ನಾಲ್ಕು · ಐದು · ಆರು · ಏಳು · ಎಂಟು · ಒಂಬತ್ತು · ಸೊನ್ನೆ
```

**English:**
```
one two three four five six seven eight nine zero
```

After the agent repeats the number, say **ಸರಿ** or **ಹೌದು**.

---

## 6. How to speak amounts

| Meaning | Kannada example | English example |
|---------|-----------------|-----------------|
| ₹1,000 | ಒಂದು ಸಾವಿರ ರೂಪಾಯಿ | one thousand rupees |
| ₹5,000 | ಐದು ಸಾವಿರ | five thousand |
| ₹10,000 | ಹತ್ತು ಸಾವಿರ | ten thousand |
| ₹50,000 | ಐವತ್ತು ಸಾವಿರ | fifty thousand |
| ₹1,00,000 | ಒಂದು ಲಕ್ಷ | one lakh |

You can also say plain digits: `5000`, `five zero zero zero`.

---

## 7. Full demo scripts

### Script A — Balance (1–2 min) ⭐ Best demo

```
1. [Stand in camera — hear greeting; wait for green Listening]
2. You:  ನನ್ನ ಖಾತೆ ಬ್ಯಾಲೆನ್ಸ್ ಹೇಳಿ
3. Agent: asks account number (wait for Listening again)
4. You:  one two three four five six seven eight nine zero
         (all 10 digits — include final zero)
5. Agent: repeats number — confirm?
6. You:  ಹೌದು
7. Agent: speaks balance for ರಾಮೇಶ್ ಕುಮಾರ್ — ₹45,230.50
8. You:  ಮುಗಿಸು   (or tap End)
```

### Script B — Cash withdrawal (3–4 min)

```
1. You:  ಹಣ ಹಿಂಪಡೆಯಬೇಕು
2. Name:     ರಾಮೇಶ್ ಕುಮಾರ್
3. Account:  1234567890 (digit by digit) → ಹೌದು
4. Amount:   ಐದು ಸಾವಿರ → ಹೌದು
5. Purpose:  ಬಿಟ್ಟುಬಿಡಿ  (skip)
6. [Form preview → Print if needed]
```

### Script C — Interest rates (30 sec)

```
1. You:  ಬಡ್ಡಿ ದರ ಎಷ್ಟು?
2. [Listen — agent speaks savings, FD, loan rates]
3. You:  ಮುಗಿಸು
```

### Script D — Form menu (2 min)

```
1. You:  ಅರ್ಜಿ ತುಂಬಬೇಕು
2. [Screen shows numbered list]
3. You:  ಎರಡು   (or say "deposit" / "cheque book")
4. [Follow form prompts]
```

---

## 8. What the agent says to you (fixed phrases)

| When | Agent says (Kannada) |
|------|----------------------|
| After greeting (if spoken) | ದಯವಿಟ್ಟು ಹೇಳಿ — ನಿಮಗೆ ಏನು ಸಹಾಯ ಬೇಕು? |
| Confirm field | [your value]. … ಹೌದು ಅಥವಾ ಮತ್ತೆ ಹೇಳಿ |
| Form summary | ನಿಮ್ಮ ಅರ್ಜಿಯ ಸಾರಾಂಶ ಇಲ್ಲಿದೆ. … |
| Form complete | ಅರ್ಜಿ ಸಿದ್ಧ… ಮುಗಿಸು ಅಥವಾ ಮುಂದುವರಿಸಿ |
| Could not hear | ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ |

While TTS is loading you may see **Preparing voice** — wait; the subtitle text is already on screen.

---

## 9. Troubleshooting

| Problem | What to do |
|---------|------------|
| No sound | Tap screen once; check volume; hard-refresh browser |
| “API offline” | Start API: `.\scripts\start-kiosk-api.ps1` on port 8000; TTS box must be ready |
| Stuck on Preparing | Wait for remote TTS (first phrase can be slow); then Listening |
| Wrong intent | Speak shorter sentence; use phrases from §2 |
| Account not recognized | Use demo accounts in §5; speak **all 10** digits slowly |
| Bot hears itself | Wait until agent finishes speaking + green Listening |
| Form stuck | Say **ಮತ್ತೆ ಹೇಳಿ** or **ಮುಗಿಸು** and start again |

---

## 10. Reference — intent → form mapping

| You ask for… | System intent | Form opened |
|--------------|---------------|-------------|
| Balance | `check_balance` | balance_inquiry |
| Withdraw | `withdraw_money` | cash_withdrawal |
| Deposit | `deposit_money` | cash_deposit |
| Open account | `open_account` | open_account |
| Loan | `apply_loan` | apply_loan |
| Interest rates | `interest_rate_query` | *(speaks info only)* |
| Account help | `account_info_query` | *(speaks info only)* |
| Form menu | form_menu route | *(pick from list)* |

Same map is live under **Admin → Conversation flow**.

---

## Related docs

- [DEMO_AND_INTERACTION_GUIDE.md](./DEMO_AND_INTERACTION_GUIDE.md) — startup, admin, troubleshooting
- [DEPLOYMENT.md](./DEPLOYMENT.md) — kiosk + TTS setup
- [END_TO_END_PROJECT_DOCUMENTATION.md](./END_TO_END_PROJECT_DOCUMENTATION.md) — full system doc

---

*Last updated: 2026-09-10 · Matches agent SpeakGuide, `data/demo_accounts.json` (6 accounts), `data/forms.json`, voice commands, and NLU intents.*
