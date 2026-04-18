import os
import torch
import numpy as np
import torch.nn.functional as F
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# -------------------------
# Environment setup (your original fix)
# -------------------------
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"

torch.set_num_threads(1)

# -------------------------
# Load model (your path)
# -------------------------
model_path = "./final_mode_V2"

print("Loading model from:", model_path)

device = "cpu"

tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
model = AutoModelForSequenceClassification.from_pretrained(model_path, local_files_only=True)

model.to(device)
model.eval()

# -------------------------
# FastAPI app
# -------------------------
app = FastAPI()

# -------------------------
# Request schema
# -------------------------
class TextRequest(BaseModel):
    text: str

# -------------------------
# Prediction function (same as yours)
# -------------------------
def predict(text: str):
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding="max_length",
        max_length=128
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probs = F.softmax(logits, dim=1)

        pred_id = torch.argmax(probs, dim=1).item()
        confidence = probs[0, pred_id].item()

    label = model.config.id2label[pred_id]

    return label, confidence

# -------------------------
# API endpoint
# -------------------------
@app.post("/predict")
def classify(req: TextRequest):
    label, confidence = predict(req.text)

    return {
        "text": req.text,
        "category": label,
        "confidence": confidence
    }