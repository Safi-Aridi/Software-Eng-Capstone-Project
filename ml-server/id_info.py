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

app = FastAPI(title="High-Assurance Lebanese Document Extraction Engine")

# Initialize Cloud Clients
vision_client = vision.ImageAnnotatorClient()
face_detector = YOLO("yolov8n.pt")

# Use the 2.5 Stable ID for high assurance
vertexai.init(project="project-7648918a-4e32-4422-9be", location="us-central1")
gemini_model = GenerativeModel("gemini-2.5-flash")

class DocumentRequest(BaseModel):
    front_url: str
    back_url: str

# ==========================================
# HELPER: QR CODE SCANNER (DETERMINISTIC)
# ==========================================
def scan_official_qr(image_bytes: bytes) -> bool:
    """
    Uses OpenCV to scan the QR code mathematically. 
    Ensures it points to the official Lebanese Directorate General of Civil Status.
    """
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
async def validate_document_package(front_bytes: bytes, back_bytes: bytes) -> dict:
    """Uses Gemini Multimodal to visually verify edges, blur, and document type."""
    front_part = Part.from_data(data=front_bytes, mime_type="image/jpeg")
    back_part = Part.from_data(data=back_bytes, mime_type="image/jpeg")
    
    prompt = """
    Analyze these two images. Image 1 is submitted as the FRONT. Image 2 is submitted as the BACK.
    Your task is to classify this document package and perform a strict anti-fraud and quality inspection.
    
    VISUAL ANCHORS FOR CLASSIFICATION:
    - "ID": 
       * Image 1 (Front) MUST be a plastic Lebanese National ID card (pink/blue gradient, face photo on left, cedar tree watermark).
       * Image 2 (Back) MUST be the back of the Lebanese National ID (barcode, map of Lebanon, orange/blue background).
    - "EXTRACT": 
       * Image 1 MUST be a Lebanese Individual Civil Registry Extract / Ikhraj Kayd (white/yellowish paper, grid lines, government stamps, AND a physical photo stapled/glued to it). 
       * Image 2 can be blank, a duplicate of Image 1, or the back of the paper.
       
    CRITICAL REJECTION RULES (Return "INVALID" if ANY of these are true):
    1. Swapped or Duplicate: Image 1 is the back of an ID, or both images show the exact same side of an ID.
    2. Mixed Documents: Image 1 is an ID but Image 2 is an Extract, or vice versa.
    3. Missing Photo: The ID Front or the Extract is missing a clear human face photo.
    4. Spoofing/Photocopies: The image is clearly a photo of a digital screen (laptop/phone) or a black-and-white paper photocopy.
    5. Obstruction: Fingers, heavy glare, or physical damage severely obscure the face, text, or barcodes.
    6. Wrong Document Type: It is a passport, driver's license, credit card, or non-Lebanese document.
    
    OUTPUT FORMAT:
    You must output strictly in JSON. The "reason" field MUST be a polite, user-facing error message suitable for a UI overlay. Do NOT reference internal backend rules, AI logic, or rule numbers.
    
    {
        "is_valid_package": true | false,
        "doc_type": "ID" | "EXTRACT" | "INVALID",
        "reason": "Clear, user-friendly explanation (e.g., 'Please upload the front of your ID in the first slot.', or 'Valid document package.')"
    }
    """
    
    config = GenerationConfig(temperature=0.0, response_mime_type="application/json")
    response = gemini_model.generate_content([prompt, front_part, back_part], generation_config=config)
    return json.loads(response.text)

# ==========================================
# 2. DYNAMIC AI POLISHER
# ==========================================
async def polish_data_with_ai(raw_text_front: str, raw_text_back: str, doc_type: str) -> dict:
    """Dynamically applies extraction rules based on the validated document type."""
    
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
    else: # EXTRACT
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
        async with httpx.AsyncClient(timeout=30) as client:
            f_resp = await client.get(request.front_url)
            b_resp = await client.get(request.back_url)

        if f_resp.status_code != 200 or b_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to download images from Supabase.")

        # --- 1. VISUAL VALIDATION (Dual-Image Check) ---
        validation_result = await validate_document_package(f_resp.content, b_resp.content)
        
        if not validation_result.get("is_valid_package"):
            raise HTTPException(
                status_code=400, 
                detail=f"Validation Failed: {validation_result.get('reason')}"
            )
            
        doc_type = validation_result.get("doc_type")

        # --- 2. EXTRACT-SPECIFIC CHECKS (QR CODE) ---
        if doc_type == "EXTRACT":
            is_valid_qr = scan_official_qr(f_resp.content)
            if not is_valid_qr:
                raise HTTPException(status_code=400, detail="Invalid or Missing QR Code: Must link to official dgcs.gov.lb portal.")

        # --- 3. RAW OCR EXTRACTION ---
        f_ocr = vision_client.document_text_detection(image=vision.Image(content=f_resp.content))
        b_ocr = vision_client.document_text_detection(image=vision.Image(content=b_resp.content))

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
                    raise HTTPException(status_code=400, detail="Civil Registry Extract is expired (Issued more than 3 months ago).")
            except ValueError:
                # If the AI failed to format the date correctly due to OCR damage
                pass 

        # --- 6. BIOMETRIC FACE CROP (High-Assurance with cascade fallback) ---
        img = cv2.imdecode(np.frombuffer(f_resp.content, np.uint8), cv2.IMREAD_COLOR)
        face_b64 = None

        # Try YOLO first (general person detector, conf lowered for ID crops)
        res = face_detector(img, classes=[0], conf=0.15)
        
        if res and len(res[0].boxes) > 0:
            b = res[0].boxes[0].xyxy[0].cpu().numpy().astype(int)
            crop = img[max(0, b[1]-20):b[3]+20, max(0, b[0]-20):b[2]+20]
            _, buffer = cv2.imencode('.jpg', crop)
            face_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
        else:
            # Fallback: OpenCV Haar Cascade (great for ID card frontal faces)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 30))
            
            if len(faces) > 0:
                # Pick largest face
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                crop = img[max(0, y-15):y+h+15, max(0, x-15):x+w+15]
                _, buffer = cv2.imencode('.jpg', crop)
                face_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
            else:
                raise HTTPException(status_code=400, detail="ID_ERROR: Could not detect a clear human face on the document. Please upload a clearer, uncropped image of your ID front.")        
            return {
            "status": "success", 
            "document_detected": doc_type,
            "data": {**final_json, "id_photo_base64": face_b64}
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        return {"status": "error", "message": f"ID_ERROR: {str(e)}"}    