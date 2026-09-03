export interface FormSummaryLine {
  field_id: string;
  label_kn: string;
  display_kn: string;
  speak_kn: string;
}

export interface FormSummaryResult {
  form_id: string;
  title_kn: string;
  summary_kn: string;
  confirm_prompt_kn: string;
  lines: FormSummaryLine[];
}

/** Mask account number for on-screen display. */
export function maskAccountDisplay(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length <= 4) return digits || "—";
  return "•".repeat(digits.length - 4) + digits.slice(-4);
}

/** Format field value for customer-facing display (not debug). */
export function displayFieldValue(
  fieldId: string,
  fieldType: string,
  value: string,
): string {
  const v = (value || "").trim();
  if (!v) return "—";
  if (
    fieldType === "digits" ||
    fieldId.includes("account") ||
    fieldId === "mobile_number" ||
    fieldId === "old_mobile" ||
    fieldId === "new_mobile"
  ) {
    if (v.replace(/\D/g, "").length >= 8) {
      return maskAccountDisplay(v);
    }
  }
  if (fieldType === "amount" || fieldId.includes("amount") || fieldId === "income") {
    const n = parseFloat(v.replace(/[^\d.]/g, ""));
    if (!Number.isNaN(n)) return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
  }
  return v;
}
