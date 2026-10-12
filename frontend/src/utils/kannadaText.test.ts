import { describe, expect, it } from "vitest";
import { transliterateKannadaToEnglish } from "./kannadaText";

// Must spell names the same way as the backend (backend/forms/as_spoken.py).
describe("transliterateKannadaToEnglish", () => {
  it.each([
    ["ಉಜ್ವಲ್", "Ujwal"],
    ["ಬಂಟ್ವಾಳ", "Bantwala"],
    ["ಮಂಗಳೂರು", "Mangaluru"],
    ["ಸಂಪತ್ ಕುಮಾರ್", "Sampat Kumar"],
    ["ಸ್ವಾಮಿ", "Swami"],
    ["ರಮೇಶ್ ಕುಮಾರ್", "Ramesh Kumar"],
    ["Ujwal", "Ujwal"],
  ])("%s → %s", (kn, en) => {
    expect(transliterateKannadaToEnglish(kn)).toBe(en);
  });
});
