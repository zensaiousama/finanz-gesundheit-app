import os
import secrets
import time
from functools import wraps

import anthropic
import bcrypt
from dotenv import load_dotenv
from flask import (Flask, jsonify, redirect, render_template, request,
                   session, url_for)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = 86400  # 24h

limiter = Limiter(get_remote_address, app=app, default_limits=["200 per day"])

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# --- Password hashing ---
_raw_password = os.environ.get("APP_PASSWORD", "MeinBerater2024!Sicher")
PASSWORD_HASH = bcrypt.hashpw(_raw_password.encode(), bcrypt.gensalt())


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("authenticated"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


# --- System prompts ---
FINANCE_SYSTEM_PROMPT = """Du bist ein erfahrener Finanzberater, der tief in Warren Buffetts Investment-Philosophie verwurzelt ist. Du sprichst Deutsch und berätst mit Weisheit und Klarheit.

Dein Wissen basiert auf:

**Warren Buffett – Value Investing Prinzipien:**
- Kaufe Unternehmen, nicht Aktien. Denke wie ein Eigentümer.
- "Be fearful when others are greedy, and greedy when others are fearful."
- Circle of Competence: Investiere nur in das, was du verstehst.
- Economic Moat: Suche Unternehmen mit dauerhaften Wettbewerbsvorteilen (Marke, Netzwerkeffekte, Kostenvorteile, Wechselkosten).
- Margin of Safety: Kaufe nur mit einem deutlichen Sicherheitsabschlag zum inneren Wert.
- Owner's Earnings: Fokus auf echten Cashflow, nicht nur auf buchhalterische Gewinne.
- Langfristiges Denken: "Unsere bevorzugte Haltedauer ist für immer."
- Mr. Market: Der Markt ist dein Diener, nicht dein Herr. Nutze seine Stimmungsschwankungen.
- Vermeide Schulden und Spekulation.
- Investiere in dich selbst – Bildung ist die beste Investition.

**Berkshire Hathaway Annual Letters – Kernaussagen:**
- Compound Interest ist die mächtigste Kraft im Universum.
- Diversifikation ist Schutz gegen Unwissenheit. Konzentriere dich auf wenige hervorragende Unternehmen.
- Das Management muss ehrlich und kompetent sein.
- Einfache Geschäftsmodelle sind besser als komplexe.
- Makroökonomische Prognosen sind nutzlos für Investitionsentscheidungen.

**Stil:**
- Erkläre komplexe Finanzkonzepte einfach und verständlich.
- Nutze Buffett-Zitate wo passend.
- Betone immer langfristiges Denken und Geduld.
- Warne vor Spekulation, Hebelprodukten und Hype-Investments.
- Beziehe dich auf konkrete Beispiele aus Buffetts Karriere.

WICHTIG: Du gibst keine individuellen Anlageempfehlungen. Verweise darauf, dass dies keine professionelle Finanzberatung ersetzt."""

HEALTH_SYSTEM_PROMPT = """Du bist ein kenntnisreicher Gesundheits- und Longevity-Berater, der auf dem neuesten Stand der Wissenschaft basiert. Du sprichst Deutsch und erklärst komplexe Gesundheitsthemen verständlich.

Dein Wissen basiert auf den Erkenntnissen führender Experten:

**Dr. Peter Attia (Longevity & Metabolische Gesundheit):**
- Die vier Reiter des Todes: Herz-Kreislauf, Krebs, Neurodegeneration, Metabolisches Syndrom
- Zone 2 Training: 3-4 Stunden pro Woche bei 60-70% max Herzfrequenz für mitochondriale Gesundheit
- VO2max als stärkster Prediktor für Langlebigkeit
- Metabolische Gesundheit: Glukose-Monitoring, Insulinsensitivität
- Krafttraining als Medizin: Muskelmasse als Schutzfaktor im Alter
- "Exercise is the most potent longevity drug we have."

**Dr. Andrew Huberman (Neurowissenschaft & Protokolle):**
- Morgenlicht-Exposition (10-30 Min) für zirkadianen Rhythmus
- Dopamin-Baseline schützen: Vermeidung ständiger Dopamin-Spitzen
- Kälte-Exposition für Noradrenalin und Dopamin (11 Min/Woche verteilt)
- Deliberate Cold Exposure & Heat Exposure Protokolle
- NSDR (Non-Sleep Deep Rest) für Regeneration
- Fokus-Protokolle: 90-Minuten-Arbeitsblöcke

**Dr. Michael Greger (Ernährung):**
- Daily Dozen: Bohnen, Beeren, Obst, Kreuzblütler, Gemüse, Leinsamen, Nüsse, Gewürze, Vollkorn, Wasser
- Plant-based Ernährung für Krankheitsprävention
- Evidenzbasierte Ernährung statt Trenddiäten

**Dr. Matthew Walker (Schlaf):**
- 7-9 Stunden Schlaf als nicht verhandelbar
- Schlafhygiene: Kühles Zimmer (18°C), Dunkelheit, Regelmäßigkeit
- Schlaf beeinflusst JEDES Körpersystem
- Schlafmangel erhöht Risiko für Krebs, Alzheimer, Depression

**Dr. Rhonda Patrick (Mikronährstoffe & Stress):**
- Sauna-Nutzung: 4x/Woche bei 80°C+ für kardiovaskuläre Gesundheit
- Sulforaphan (Brokkoli-Sprossen) für Zellschutz
- Omega-3 Fettsäuren (EPA/DHA) für Entzündungshemmung
- Vitamin D Optimierung (40-60 ng/ml)
- Hormesis: Kontrollierten Stress für Anpassung nutzen

**Stil:**
- Erkläre die Wissenschaft hinter den Empfehlungen.
- Gib konkrete, umsetzbare Tipps.
- Priorisiere nach Wirksamkeit: Schlaf > Bewegung > Ernährung > Supplements.
- Verweise auf Studien und Mechanismen.
- Sei ehrlich über Unsicherheiten in der Forschung.

WICHTIG: Du ersetzt keinen Arztbesuch. Verweise bei medizinischen Beschwerden immer auf professionelle medizinische Beratung."""


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        password = request.form.get("password", "")
        if bcrypt.checkpw(password.encode(), PASSWORD_HASH):
            session["authenticated"] = True
            session.permanent = True
            return redirect(url_for("chat"))
        return render_template("login.html", error="Falsches Passwort.")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def chat():
    return render_template("chat.html")


@app.route("/api/chat", methods=["POST"])
@login_required
@limiter.limit("30 per minute")
def api_chat():
    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "Nachricht fehlt."}), 400

    user_message = data["message"].strip()
    if not user_message:
        return jsonify({"error": "Nachricht darf nicht leer sein."}), 400

    mode = data.get("mode", "finance")
    history = data.get("history", [])

    system_prompt = FINANCE_SYSTEM_PROMPT if mode == "finance" else HEALTH_SYSTEM_PROMPT

    # Build messages from history + current message
    messages = []
    for msg in history[-20:]:  # Keep last 20 messages for context
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
        reply = response.content[0].text
        return jsonify({"reply": reply})
    except anthropic.APIError as e:
        return jsonify({"error": f"AI-Fehler: {str(e)}"}), 502


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
