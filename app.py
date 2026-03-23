import io
import os
import json

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

from model import run_prediction, process_lab_csv
from clinical_summary import get_clinical_summary

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/predict", methods=["POST"])
def predict():
    note_text = request.form.get("note_text", "").strip()
    lab_file  = request.files.get("lab_csv")

    if not note_text:
        return jsonify({"error": "Clinical note text is required."}), 400
    if not lab_file:
        return jsonify({"error": "Lab CSV file is required."}), 400

    try:
        labs_tensor, labs_df = process_lab_csv(io.BytesIO(lab_file.read()))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        prob = run_prediction(note_text, labs_tensor)
    except Exception as e:
        return jsonify({"error": f"Model inference failed: {e}"}), 500

    cols = ["Lactate", "WBC", "Creatinine", "Platelets", "Bilirubin"]
    last_row  = labs_df.iloc[-1]
    first_row = labs_df.iloc[0]

    return jsonify({
        "probability":  prob,
        "risk_percent": round(prob * 100, 2),
        "status":       "ALERT" if prob > 0.35 else "STABLE",
        "lab_trends":   {c: labs_df[c].tolist() for c in cols},
        "last_values":  {c: round(float(last_row[c]), 3)  for c in cols},
        "deltas":       {c: round(float(last_row[c] - first_row[c]), 3) for c in cols},
    })


@app.route("/api/clinical-summary", methods=["POST"])
def clinical_summary():
    data = request.get_json(force=True, silent=True) or {}
    note = data.get("note_text", "").strip()
    if not note:
        return jsonify({"error": "note_text is required."}), 400

    summary = get_clinical_summary(note)
    return jsonify({"summary": summary})


if __name__ == "__main__":
    print("⚙️  Pre-loading AI models …")
    try:
        from model import load_models
        load_models()
        print("✅  Models loaded successfully.")
    except Exception as e:
        print(f"⚠️  Model pre-load failed (will retry on first request): {e}")

    app.run(host="0.0.0.0", port=5000, debug=True)
