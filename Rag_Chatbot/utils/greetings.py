import re

GREETINGS = {
    "hi",
    "hello",
    "hey",
    "namaste",
    "pranam",
    "vanakkam",
    "good morning",
    "good afternoon",
    "good evening",
    "how are you",
    "whats up",
    "what's up",
    "thanks",
    "thank you",
    "bye",
    "goodbye",
    "see you"
}

SCHEMES_GREETING = (
    "Namaste 🙏 I am your KisanGuard Agricultural Scheme Advisory Assistant.\n\n"
    "I provide verified guidance directly from official Ministry operational guidelines across all 5 key agricultural schemes:\n"
    "• **PM-KISAN:** Income support (₹6,000/yr in 3 installments), eligibility, exclusion categories, and eKYC/DBT disbursals.\n"
    "• **PMFBY (Crop Insurance):** Non-preventable crop risk coverage, subsidized farmer premium rates (2% Kharif, 1.5% Rabi, 5% commercial), and claim settlement.\n"
    "• **Physical Verification Protocols:** 5% mandatory annual field inspections, verification checklists, and ineligibility recovery procedures.\n"
    "• **Agricultural Procurement & MSP:** Minimum Support Price procurement operations, Fair Average Quality (FAQ) standards, and direct payment timelines.\n"
    "• **Digital Declarations & Land Records:** Farmer self-declaration documentation, land title validation, and portal authentication.\n\n"
    "Which scheme or guideline would you like information on today?"
)

def normalize(text):
    if text is None:
        return ""
    text = str(text).lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    return text

def is_greeting(text):
    text = normalize(text)
    return text in GREETINGS

def greeting_response(text):
    text = normalize(text)

    if text in {"hi", "hello", "hey", "namaste", "pranam", "vanakkam"}:
        return SCHEMES_GREETING

    if text == "good morning":
        return f"Good morning! ☀️\n\n{SCHEMES_GREETING}"

    if text == "good afternoon":
        return f"Good afternoon! 🌾\n\n{SCHEMES_GREETING}"

    if text == "good evening":
        return f"Good evening! 🌾\n\n{SCHEMES_GREETING}"

    if text == "how are you":
        return (
            "I am doing well, thank you! 🙏 I am ready to guide you across all 5 official agricultural schemes "
            "(PM-KISAN, PMFBY, Physical Verification, MSP Procurement, and Digital Declarations). "
            "How can I assist you today?"
        )

    if text in {"thanks", "thank you"}:
        return (
            "You are very welcome! 🙏 Please let me know if you need any further clarification on "
            "PM-KISAN, PMFBY crop insurance, or government procurement guidelines."
        )

    if text in {"bye", "goodbye", "see you"}:
        return "Goodbye! Wishing you a bountiful harvest. Feel free to return anytime you need scheme guidance! 🌾"

    return SCHEMES_GREETING