import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from transformers import AutoTokenizer, AutoModel
import os

# ─── Model Definition ─────────────────────────────────────────────────────────

class SepsisTransformerMultimodal(nn.Module):
    def __init__(self, lab_features=5, time_steps=24, bert_dim=768, d_model=64, nhead=4):
        super(SepsisTransformerMultimodal, self).__init__()
        self.lab_projection = nn.Linear(lab_features, d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=128,
            batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=2)
        self.bert_projection = nn.Linear(bert_dim, d_model)
        self.relu = nn.ReLU()
        self.fusion = nn.Linear(d_model + d_model, 32)
        self.classifier = nn.Linear(32, 1)

    def forward(self, x_time, x_text):
        x_time = self.lab_projection(x_time)
        time_out = self.transformer_encoder(x_time)
        time_features = torch.mean(time_out, dim=1)
        text_features = self.relu(self.bert_projection(x_text))
        combined = torch.cat((time_features, text_features), dim=1)
        return self.classifier(self.relu(self.fusion(combined)))


# ─── Singleton Model Cache ─────────────────────────────────────────────────────

_cache = {}

def load_models():
    """Load and cache tokenizer, BERT, and sepsis model."""
    if _cache:
        return _cache["tokenizer"], _cache["bert_model"], _cache["sepsis_model"]

    tokenizer = AutoTokenizer.from_pretrained("emilyalsentzer/Bio_ClinicalBERT")
    bert_model = AutoModel.from_pretrained("emilyalsentzer/Bio_ClinicalBERT")

    model_path = os.path.join(os.path.dirname(__file__), "..", "sepsis_model.pth")
    sepsis_model = SepsisTransformerMultimodal()
    sepsis_model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
    sepsis_model.eval()

    _cache["tokenizer"] = tokenizer
    _cache["bert_model"] = bert_model
    _cache["sepsis_model"] = sepsis_model

    return tokenizer, bert_model, sepsis_model


# ─── Inference Helpers ─────────────────────────────────────────────────────────

def get_text_embedding(text, tokenizer, bert_model):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = bert_model(**inputs)
    return outputs.last_hidden_state[:, 0, :]


def process_lab_csv(file_stream):
    """
    Read a CSV file-like object, normalise to exactly 24 rows,
    and return a (1, 24, 5) float tensor plus the raw DataFrame.
    """
    df = pd.read_csv(file_stream)
    required_cols = ["Lactate", "WBC", "Creatinine", "Platelets", "Bilirubin"]

    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    if len(df) > 24:
        df = df.tail(24)
    elif len(df) < 24:
        padding = pd.DataFrame([df.iloc[0]] * (24 - len(df)), columns=df.columns)
        df = pd.concat([padding, df], ignore_index=True)

    lab_values = df[required_cols].values
    tensor = torch.tensor(lab_values).float().unsqueeze(0)
    return tensor, df[required_cols].reset_index(drop=True)


def run_prediction(note_text: str, labs_tensor: torch.Tensor):
    """Run the full inference pipeline and return probability (0-1)."""
    tokenizer, bert_model, sepsis_model = load_models()
    text_emb = get_text_embedding(note_text, tokenizer, bert_model)
    with torch.no_grad():
        logits = sepsis_model(labs_tensor, text_emb)
        prob = torch.sigmoid(logits).item()
    return prob
