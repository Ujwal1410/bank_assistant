# What to Speak — Kannada Voice Banking Guide

**Audience:** Demo staff, testers, college lab customers  
**Agent URL:** `https://localhost:5173` (or your kiosk IP)  
**Language:** Speak **Kannada** clearly; **English** also works for most intents (STT translates internally).

> **Demo only** — no real money moves. Forms are sample branch slips, not official bank documents.

---

## Quick start

1. Admin opens counter → customer steps into camera frame.
2. Listen to the **time-based Kannada greeting**.
3. When you see **ಕೇಳುತ್ತಿದ್ದೇನೆ… · Listening**, speak your request.
4. Follow voice prompts for forms — confirm each value with **ಸರಿ** or **ಹೌದು**.
5. Say **ಮುಗಿಸು** or tap **End** to finish.

**Tips**

- Tap the screen once if no sound (browser audio unlock).
- Wait until the bot **stops speaking** before you talk (reduces echo).
- Speak **slowly and clearly**; for account numbers, say **one digit at a time**.
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

Say any phrase below after the agent asks *ನಿಮಗೆ ಏನು ಸಹಾಯ ಬೇಕು?*

### A. Check balance → opens balance form

| Say in Kannada | Say in English |
|----------------|----------------|
| ನನ್ನ ಖಾತೆಯ ಬಾಕಿ ಎಷ್ಟು? | What is my account balance? |
| ಬಾಕಿ ತಿಳಿಸಿ | Tell me my balance |
| ಖಾತೆ ಬಾಕಿ ಪರಿಶೀಲಿಸಿ | Check my account balance |
| ನನ್ನ ಖಾತೆಯಲ್ಲಿ ಎಷ್ಟು ಹಣ ಇದೆ? | How much money is in my account? |
| ಬ್ಯಾಲೆನ್ಸ್ ಎಷ್ಟು? | What is the balance? |

**What happens:** Agent asks for **account number** → you speak it → confirms → speaks balance in Kannada.

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
| ಖಾತೆ ತೆರೆಯಲು ಬಯಸುತ್ತೇನೆ | I would like to open an account |
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

---

## 4. All forms — what the agent will ask

For each form, the agent speaks the **prompt_kn** shown below. Answer in voice; confirm with **ಸರಿ**.

### 4.1 ಖಾತೆ ಬಾಕಿ ಪರಿಶೀಲನೆ (Balance inquiry)

| Field | Agent asks (Kannada) | You say |
|-------|----------------------|---------|
| Account number | ದಯವಿಟ್ಟು ನಿಮ್ಮ ಖಾತೆ ಸಂಖ್ಯೆಯನ್ನು ಹೇಳಿ | Demo account (see §5) — digit by digit |

---

### 4.2 ನಗದು ಹಿಂಪಡೆಯುವ ಸ್ಲಿಪ್ (Cash withdrawal)

| Field | Agent asks | You say (example) |
|-------|------------|-------------------|
| Name | ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ಹೇಳಿ | ರಾಮೇಶ್ ಕುಮಾರ್ |
| Account | ದಯವಿಟ್ಟು ನಿಮ್ಮ ಖಾತೆ ಸಂಖ್ಯೆಯನ್ನು ಹೇಳಿ | 1234567890 (digit by digit) |
| Amount | ಹಿಂಪಡೆಯುವ ಮೊತ್ತವನ್ನು ಹೇಳಿ | ಐದು ಸಾವಿರ / five thousand / 5000 |
| Purpose (optional) | ಉದ್ದೇಶ… ಬಿಟ್ಟುಬಿಡಿ ಎಂದು ಹೇಳಿ | ವೈಯಕ್ತಿಕ ಬಳಕೆ — or **ಬಿಟ್ಟುಬಿಡಿ** |

Date is filled automatically (today).

---

### 4.3 ನಗದು / ಚೆಕ್ ಠೇವಣಿ ಸ್ಲಿಪ್ (Cash / cheque deposit)

| Field | Agent asks | You say (example) |
|-------|------------|-------------------|
| Name | ಪೂರ್ಣ ಹೆಸರು | ರಾಮೇಶ್ ಕುಮಾರ್ |
| Account | ಖಾತೆ ಸಂಖ್ಯೆ | 1234567890 |
| Amount | ಠೇವಣಿ ಮೊತ್ತ | ಮೂರು ಸಾವಿರ / 3000 |
| Deposit mode | ನಗದು ಅಥವಾ ಚೆಕ್ | ನಗದು or ಚೆಕ್ |

---

### 4.4 ವೈಯಕ್ತಿಕ ಖಾತೆ ತೆರೆಯುವ ಅರ್ಜಿ (Open account)

| Field | Agent asks | You say (example) |
|-------|------------|-------------------|
| Full name | ಪೂರ್ಣ ಹೆಸರು | ನಿಮ್ಮ ಹೆಸರು |
| Date of birth | ಜನ್ಮ ದಿನಾಂಕ — ದಿನ, ತಿಂಗಳು, ವರ್ಷ | 15 ಜೂನ್ 1990 |
| Address | ವಾಸದ ವಿಳಾಸ | ನಿಮ್ಮ ವಿಳಾಸ |
| Mobile | ಹತ್ತು ಅಂಕಿಯ ಮೊಬೈಲ್ | 9876543210 |
| PAN | ಪ್ಯಾನ್ ಸಂಖ್ಯೆ | ABCDE1234F |
| Account type | ಸೇವಿಂಗ್ಸ್, ಕರೆಂಟ್ ಅಥವಾ ಸ್ಯಾಲರಿ | ಸೇವಿಂಗ್ಸ್ |

---

### 4.5 ಚಿಲ್ಲರೆ ಸಾಲ ಅರ್ಜಿ (Loan application)

| Field | Agent asks | You say (example) |
|-------|------------|-------------------|
| Name | ಪೂರ್ಣ ಹೆಸರು | ನಿಮ್ಮ ಹೆಸರು |
| Mobile | ಮೊಬೈಲ್ ಸಂಖ್ಯೆ | 9876543210 |
| Loan type | ಸಾಲದ ವಿಧ | ವೈಯಕ್ತಿಕ ಸಾಲ / home loan |
| Loan amount | ಸಾಲದ ಮೊತ್ತ | ಐದು ಲಕ್ಷ / five lakh |
| Income | ಮಾಸಿಕ ಆದಾಯ | ನಲ್ವತ್ತು ಸಾವಿರ |

---

### 4.6 RTGS / NEFT ವರ್ಗಾವಣೆ (Fund transfer)

| Field | You say (example) |
|-------|-------------------|
| Remitter name | Your name |
| Remitter account | Your account number |
| Beneficiary name | Receiver name |
| Beneficiary account | Receiver account |
| IFSC | e.g. SBIN0001234 |
| Amount | Transfer amount |
| Remarks (optional) | Payment reason — or **ಬಿಟ್ಟುಬಿಡಿ** |

---

### 4.7 ಚೆಕ್ ಬುಕ್ ವಿನಂತಿ (Cheque book)

| Field | You say |
|-------|---------|
| Name | Your name |
| Account | Account number |
| Number of leaves | 10 / 25 / 50 |

---

### 4.8 ATM / ಡೆಬಿಟ್ ಕಾರ್ಡ್ ಅರ್ಜಿ

| Field | You say |
|-------|---------|
| Name | Your name |
| Account | Account number |
| Mobile | Mobile number |
| Card type | ATM / debit / RuPay |

---

### 4.9 ಸ್ಥಿರ ಠೇವಣಿ (FD)

| Field | You say |
|-------|---------|
| Name | Your name |
| Account | Account number |
| FD amount | e.g. ಒಂದು ಲಕ್ಷ |
| Tenure | e.g. ಒಂದು ವರ್ಷ / 1 year |
| Interest payout | monthly / quarterly / maturity |

---

### 4.10 ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನವೀಕರಣ

| Field | You say |
|-------|---------|
| Name | Your name |
| Account | Account number |
| Old mobile | Old 10-digit number |
| New mobile | New 10-digit number |

---

### 4.11 ಚೆಕ್ ನಿಲ್ಲಿಸುವ ವಿನಂತಿ (Stop cheque)

| Field | You say |
|-------|---------|
| Name | Your name |
| Account | Account number |
| Cheque number | Cheque number |
| Amount | Cheque amount |
| Reason (optional) | Lost / stolen — or **ಬಿಟ್ಟುಬಿಡಿ** |

---

## 5. Demo account numbers (balance only)

**Only these accounts return a balance.** Any other number → “account not found” in Kannada.

| Account number | Name (Kannada) | Balance (₹) | Type |
|----------------|----------------|-------------|------|
| **1234567890** | ರಾಮೇಶ್ ಕುಮಾರ್ | 45,230.50 | Savings |
| **9876543210** | ಅನಿತಾ ರಾವ್ | 12,500.00 | Savings |
| **1111222233** | ಸುರೇಶ್ ಗೌಡ | 89,340.75 | Current |

### How to speak account numbers

**Best:** One digit at a time, pause between each.

**Kannada (for 1234567890):**
```
ಒಂದು · ಎರಡು · ಮೂರು · ನಾಲ್ಕು · ಐದು · ಆರು · ಏಳು · ಎಂಟು · ಒಂಬತ್ತು · ಸೊನ್ನೆ
```

**English:**
```
one two three four five six seven eight nine zero
```

**Or:** Say the full number slowly: `1 2 3 4 5 6 7 8 9 0`

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
1. [Stand in camera — hear greeting]
2. You:  ನನ್ನ ಖಾತೆಯ ಬಾಕಿ ಎಷ್ಟು?
3. Agent: asks account number
4. You:  one two three four five six seven eight nine zero
         (or Kannada digits slowly)
5. Agent: repeats number — "ಸರಿಯೇ?"
6. You:  ಸರಿ
7. Agent: speaks balance for ರಾಮೇಶ್ ಕುಮಾರ್ — ₹45,230.50
8. You:  ಮುಗಿಸು   (or tap End)
```

---

### Script B — Cash withdrawal (3–4 min)

```
1. You:  ಹಣ ಹಿಂಪಡೆಯಬೇಕು
2. Name:     ರಾಮೇಶ್ ಕುಮಾರ್
3. Account:  1234567890 (digit by digit) → ಸರಿ
4. Amount:   ಐದು ಸಾವಿರ → ಸರಿ
5. Purpose:  ಬಿಟ್ಟುಬಿಡಿ  (skip)
6. [Form preview → Print if needed]
7. Agent: ಬೇರೆ ಯಾವುದಾದರೂ ಸಹಾಯ ಬೇಕೇ?
```

---

### Script C — Interest rates (30 sec)

```
1. You:  ಬಡ್ಡಿ ದರ ಎಷ್ಟು?
2. [Listen — agent speaks savings, FD, loan rates]
3. You:  ಧನ್ಯವಾದ / ಮುಗಿಸು
```

---

### Script D — Form menu (2 min)

```
1. You:  ಅರ್ಜಿ ತುಂಬಬೇಕು
2. [Screen shows numbered list]
3. You:  ಎರಡು   (or say "deposit")
4. [Follow deposit form prompts]
```

---

## 8. What the agent says to you (fixed phrases)

| When | Agent says (Kannada) |
|------|----------------------|
| After greeting | ದಯವಿಟ್ಟು ಹೇಳಿ — ನಿಮಗೆ ಏನು ಸಹಾಯ ಬೇಕು? |
| Confirm field | [your value]. ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಮತ್ತೆ ಹೇಳಿ. |
| Form complete | ಅರ್ಜಿ ಸಿದ್ಧ. ಪ್ರಿಂಟ್ ಮಾಡಬಹುದು. ಮುಗಿಸು ಅಥವಾ ಮುಂದುವರಿಸಿ. |
| After form / task | ಬೇರೆ ಯಾವುದಾದರೂ ಸಹಾಯ ಬೇಕೇ? ಹೌದು ಎಂದರೆ ಕೇಳಿ, ಮುಗಿಸು ಎಂದರೆ ನಿಲ್ಲಿಸುತ್ತೇವೆ. |
| Could not hear | ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ |

---

## 9. Troubleshooting

| Problem | What to do |
|---------|------------|
| No sound | Tap screen once; check volume; hard-refresh browser |
| “API offline” | Start API: `.\scripts\start-kiosk-api.ps1` on port 8000 |
| Wrong intent | Speak shorter sentence; use phrases from §2 |
| Account not recognized | Use demo accounts in §5; speak digits slowly |
| Bot hears itself | Wait until agent finishes speaking |
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

---

## Related docs

- [DEMO_AND_INTERACTION_GUIDE.md](./DEMO_AND_INTERACTION_GUIDE.md) — startup, admin, troubleshooting
- [VOICE_FORM_UX_PLAN.md](./VOICE_FORM_UX_PLAN.md) — upcoming UI/read-back improvements
- [DEPLOYMENT.md](./DEPLOYMENT.md) — kiosk + TTS setup

---

*Last updated: 2026-09-02 · Matches `data/forms.json`, `voiceCommands.ts`, and NLU intents in this repo.*
