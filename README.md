# 🧠 SepsisAI

SepsisAI is an AI-powered clinical decision support system designed to assess the risk of **sepsis** by combining **clinical notes (text data)** and **laboratory time-series data**. It leverages a multimodal deep learning architecture integrating transformer-based models and biomedical language understanding.

---

## 🚀 Features

* 🔬 **Multimodal Prediction**

  * Clinical notes processed using BioClinicalBERT
  * Lab values analyzed using a Transformer encoder
* 📊 **Lab Trend Analysis**

  * Tracks key biomarkers over time:

    * Lactate
    * WBC
    * Creatinine
    * Platelets
    * Bilirubin
* ⚠️ **Risk Scoring**

  * Outputs probability and risk percentage
  * Provides status: `ALERT` or `STABLE`
* 🧾 **Clinical Summary Generation**

  * Generates concise summaries from clinical notes
* 🌐 **Web Interface**

  * Built with Flask for easy interaction

---

## 🏗️ Project Structure

```
SepsisAI/
│
├── app.py                  # Flask backend API
├── model.py               # Multimodal deep learning model
├── clinical_summary.py    # Clinical note summarization
├── requirements.txt       # Dependencies
├── README.md              # Project documentation
├── .env                   # Environment variables
├── .gitignore             # Git ignore rules
│
├── templates/             # HTML templates (frontend)
├── static/                # CSS/JS assets
│
├── low_sepsis.csv         # Sample dataset (low risk)
├── sepsis_crash.csv       # Sample dataset (high risk)
```

---

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/SepsisAI.git
cd SepsisAI
```

### 2. Create virtual environment

```bash
python -m venv venv
source venv/bin/activate   # On Linux/Mac
venv\Scripts\activate      # On Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

## 📦 Model Requirements

* Pretrained model:

  * `Bio_ClinicalBERT` (automatically downloaded via HuggingFace)
* You must provide:

  * `sepsis_model.pth` (trained model weights)

Place it in the root directory:

```
SepsisAI/
└── sepsis_model.pth
```

---

## ▶️ Running the Application

```bash
python app.py
```

Then open your browser:

```
http://localhost:5000
```

---

## 📡 API Endpoints

### 🔍 `/api/predict` (POST)

Predict sepsis risk using clinical notes + lab CSV.

#### Request:

* `note_text` (string)
* `lab_csv` (file)

#### Response:

```json
{
  "probability": 0.72,
  "risk_percent": 72.0,
  "status": "ALERT",
  "lab_trends": {...},
  "last_values": {...},
  "deltas": {...}
}
```

---

### 🧾 `/api/clinical-summary` (POST)

Generate a clinical summary from notes.

#### Request:

```json
{
  "note_text": "Patient shows signs of infection..."
}
```

#### Response:

```json
{
  "summary": "Condensed clinical summary..."
}
```

---

## 🧠 Model Architecture

The system uses a **multimodal transformer-based architecture**:

### 🔹 Text Pipeline

* BioClinicalBERT encodes clinical notes into embeddings

### 🔹 Time-Series Pipeline

* Lab values processed using:

  * Linear projection
  * Transformer Encoder

### 🔹 Fusion Layer

* Combines text + lab features
* Fully connected layers for classification

---

## 📊 Input Format

### Clinical Notes

* Free-text medical notes

### Lab CSV Format

Must include columns:

```
Lactate, WBC, Creatinine, Platelets, Bilirubin
```

Each row represents a time step.

---

## ⚠️ Disclaimer

This project is for **research and educational purposes only**.
It is **not intended for real-world medical diagnosis or treatment decisions**.

---

## 🛠️ Future Improvements

* Real-time monitoring integration
* Explainable AI (feature attribution)
* EHR system integration
* Improved UI/UX dashboard
* Model optimization for deployment

---
