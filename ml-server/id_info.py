import os
import base64
import json
import httpx
import cv2
import numpy as np
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google.cloud import vision
import vertexai
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig
from ultralytics import YOLO

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="High-Assurance Lebanese Document Extraction Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Cloud Clients
vision_client = vision.ImageAnnotatorClient()
face_detector = YOLO("yolov8n.pt")

vertexai.init(project="project-7648918a-4e32-4422-9be", location="us-central1")
gemini_model = GenerativeModel("gemini-2.5-flash")


class DocumentRequest(BaseModel):
    document_type: str = "id_card"
    front_url: str | None = None
    back_url: str | None = None
    document_url: str | None = None  # For civil registry extract


# ==========================================
# HELPER: QR CODE SCANNER (DETERMINISTIC)
# ==========================================

def scan_official_qr(image_bytes: bytes) -> bool:
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    detector = cv2.QRCodeDetector()
    data, bbox, _ = detector.detectAndDecode(img)
    if data and data.startswith("https://www.dgcs.gov.lb/arabic/ekhraj-al-kaid-electronic/"):
        return True
    return False


# ==========================================
# 1. THE GATEKEEPER: VISUAL VALIDATION
# ==========================================

async def validate_document_package(front_bytes: bytes, back_bytes: bytes, document_type: str = "id_card") -> dict:
    front_part = Part.from_data(data=front_bytes, mime_type="image/jpeg")
    back_part = Part.from_data(data=back_bytes, mime_type="image/jpeg")

    if document_type == "civil_registry":
        prompt = """
You are analyzing a Lebanese Civil Registry Extract (Ikhraj Kayd).
This is a SINGLE-PAGE document. Both images provided may be identical — this is expected and valid, do NOT penalize it.

Your job is to verify:
1. Is this a Lebanese Civil Registry Extract? (white or yellowish paper, printed grid/table, government stamps, Arabic text)
2. Does it have a clear human face photo physically attached (stapled or glued) to it?
3. Is it a photo of a screen or a black-and-white photocopy? If so, reject it.

Output ONLY strict JSON:
{
    "is_valid_package": true,
    "doc_type": "EXTRACT",
    "reason": "Valid Civil Registry Extract."
}

If any check fails, set is_valid_package to false and explain clearly in the reason field in a user-friendly way.
"""
    else:
        prompt = """
Analyze these two images. Image 1 is submitted as the FRONT. Image 2 is submitted as the BACK.
Your task is to classify this document package and perform a strict anti-fraud and quality inspection.

VISUAL ANCHORS FOR CLASSIFICATION:
- "ID":
   * Image 1 (Front) MUST be a plastic Lebanese National ID card (pink/blue gradient, face photo on left, cedar tree watermark).
   * Image 2 (Back) MUST be the back of the Lebanese National ID (barcode, map of Lebanon, orange/blue background).

CRITICAL REJECTION RULES (Return "INVALID" if ANY of these are true):
1. Swapped or Duplicate: Image 1 is the back of an ID, or both images show the exact same side of an ID.
2. Missing Photo: The ID Front is missing a clear human face photo.
3. Spoofing/Photocopies: The image is clearly a photo of a digital screen or a black-and-white photocopy.
4. Obstruction: Fingers, heavy glare, or physical damage severely obscure the face, text, or barcodes.
5. Wrong Document Type: It is a passport, driver's license, credit card, or non-Lebanese document.

Output ONLY strict JSON:
{
    "is_valid_package": true | false,
    "doc_type": "ID" | "INVALID",
    "reason": "Clear, user-friendly explanation"
}
"""

    config = GenerationConfig(temperature=0.0, response_mime_type="application/json")
    response = gemini_model.generate_content([prompt, front_part, back_part], generation_config=config)
    return json.loads(response.text)


# ==========================================
# 2. DYNAMIC AI POLISHER
# ==========================================

async def polish_data_with_ai(raw_text_front: str, raw_text_back: str, doc_type: str) -> dict:
    base_rules = """
RULES:
1. Transliterate all Arabic names phonetically into the Latin alphabet (e.g., 'حبيب' -> 'Habib'). DO NOT translate them semantically.
2. Transliterate Lebanese locations and proper nouns into their standard phonetic spelling (e.g., 'بيروت' -> 'Beirut', 'عاليه' -> 'Aley').
3. Marital status must be strictly mapped to: 'Single', 'Married', 'Divorced', or 'Widowed'.
4. Numbers must be provided in both 'latin' (0-9) and 'hindu' (٠-٩) formats.
5. The mother's name field must automatically filter out and remove the identifying word 'وشهرتها' if present.
6. CRITICAL: Extract the 'date_of_issue' and format it STRICTLY as 'YYYY-MM-DD' using the Gregorian calendar.
"""

    if doc_type == "ID":
        schema_definition = """
REQUIRED JSON SCHEMA:
{
    "first_name": {"ar": "", "en": ""},
    "last_name": {"ar": "", "en": ""},
    "father_name": {"ar": "", "en": ""},
    "mother_name": {"ar": "", "en": ""},
    "place_of_birth": {"ar": "", "en": ""},
    "dob": {"latin": "", "hindu": ""},
    "id_number": {"latin": "", "hindu": ""},
    "gender": {"ar": "", "en": ""},
    "marital_status": {"ar": "", "en": ""},
    "registry_number": {"latin": "", "hindu": ""},
    "locality": {"ar": "", "en": ""},
    "governorate": {"ar": "", "en": ""},
    "district": {"ar": "", "en": ""},
    "date_of_issue": "YYYY-MM-DD"
}
"""
    else:  # EXTRACT
        base_rules += "\n7. Extract the document tracking number (رقم الوثيقة / رقم الاخراج) and map it to 'extract_number'."
        schema_definition = """
REQUIRED JSON SCHEMA:
{
    "first_name": {"ar": "", "en": ""},
    "last_name": {"ar": "", "en": ""},
    "father_name": {"ar": "", "en": ""},
    "mother_name": {"ar": "", "en": ""},
    "place_of_birth": {"ar": "", "en": ""},
    "dob": {"latin": "", "hindu": ""},
    "extract_number": {"latin": "", "hindu": ""},
    "gender": {"ar": "", "en": ""},
    "marital_status": {"ar": "", "en": ""},
    "registry_number": {"latin": "", "hindu": ""},
    "locality": {"ar": "", "en": ""},
    "governorate": {"ar": "", "en": ""},
    "district": {"ar": "", "en": ""},
    "date_of_issue": "YYYY-MM-DD"
}
"""

    prompt = f"""
You are a professional Lebanese document registrar.
Convert this raw OCR text from a Lebanese {doc_type} into a strictly formatted JSON object.

{base_rules}

{schema_definition}

RAW FRONT TEXT: {raw_text_front}
RAW BACK TEXT: {raw_text_back}
"""

    config = GenerationConfig(temperature=0.0, response_mime_type="application/json")
    response = gemini_model.generate_content(prompt, generation_config=config)
    return json.loads(response.text)


# ==========================================
# MAIN ROUTE
# ==========================================

@app.post("/extract-id-data")
async def extract_id_data(request: DocumentRequest):
    try:
        # --- DOWNLOAD: Read bytes once, reuse safely ---
        async with httpx.AsyncClient(timeout=30) as client:
            if request.document_type == "civil_registry":
                if not request.document_url:
                    raise HTTPException(status_code=400, detail="ID_ERROR: document_url is required for civil registry extract.")
                f_resp = await client.get(request.document_url)
                if f_resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="ID_ERROR: Failed to download civil registry extract.")
                f_content = f_resp.content
                b_content = f_content  # Same bytes reused safely — no double-read
            else:
                if not request.front_url or not request.back_url:
                    raise HTTPException(status_code=400, detail="ID_ERROR: front_url and back_url are required for ID card.")
                f_resp = await client.get(request.front_url)
                b_resp = await client.get(request.back_url)
                if f_resp.status_code != 200 or b_resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="ID_ERROR: Failed to download ID card images.")
                f_content = f_resp.content
                b_content = b_resp.content

        # --- 1. VISUAL VALIDATION ---
        validation_result = await validate_document_package(f_content, b_content, request.document_type)

        if not validation_result.get("is_valid_package"):
            raise HTTPException(
                status_code=400,
                detail=f"ID_ERROR: {validation_result.get('reason')}"
            )

        doc_type = validation_result.get("doc_type")

        # --- 2. EXTRACT-SPECIFIC CHECKS (QR CODE) ---
        if doc_type == "EXTRACT":
            is_valid_qr = scan_official_qr(f_content)
            if not is_valid_qr:
                raise HTTPException(status_code=400, detail="ID_ERROR: Invalid or missing QR Code. The document must link to the official dgcs.gov.lb portal.")

        # --- 3. RAW OCR EXTRACTION ---
        f_ocr = vision_client.document_text_detection(image=vision.Image(content=f_content))
        b_ocr = vision_client.document_text_detection(image=vision.Image(content=b_content))

        # --- 4. DYNAMIC DATA POLISHING ---
        final_json = await polish_data_with_ai(
            f_ocr.full_text_annotation.text if f_ocr.full_text_annotation else "",
            b_ocr.full_text_annotation.text if b_ocr.full_text_annotation else "",
            doc_type
        )

        # --- 5. EXTRACT-SPECIFIC CHECKS (EXPIRATION DATE) ---
        if doc_type == "EXTRACT":
            try:
                issue_date = datetime.strptime(final_json.get("date_of_issue", ""), "%Y-%m-%d")
                ninety_days_ago = datetime.now() - timedelta(days=90)
                if issue_date < ninety_days_ago:
                    raise HTTPException(status_code=400, detail="ID_ERROR: Civil Registry Extract is expired (issued more than 3 months ago).")
            except ValueError:
                pass

        # --- 6. BIOMETRIC FACE CROP (YOLO with Haar Cascade fallback) ---
        img = cv2.imdecode(np.frombuffer(f_content, np.uint8), cv2.IMREAD_COLOR)
        face_b64 = None

        res = face_detector(img, classes=[0], conf=0.15)

        if res and len(res[0].boxes) > 0:
            b = res[0].boxes[0].xyxy[0].cpu().numpy().astype(int)
            crop = img[max(0, b[1]-20):b[3]+20, max(0, b[0]-20):b[2]+20]
            _, buffer = cv2.imencode('.jpg', crop)
            face_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
        else:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 30))

            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                crop = img[max(0, y-15):y+h+15, max(0, x-15):x+w+15]
                _, buffer = cv2.imencode('.jpg', crop)
                face_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
            else:
                raise HTTPException(
                    status_code=400,
                    detail="ID_ERROR: Could not detect a clear human face on the document. Please upload a clearer, uncropped image."
                )

        return {
            "status": "success",
            "document_detected": doc_type,
            "data": {**final_json, "id_photo_base64": face_b64}
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        return {"status": "error", "message": f"ID_ERROR: {str(e)}"}