import base64
import json
import httpx
import cv2
import numpy as np
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import vertexai
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig
from deepface import DeepFace

app = FastAPI(title="High-Assurance Passport Photo Validation")

# Initialize Gemini for Anti-Spoofing & Quality Gate
vertexai.init(project="project-7648918a-4e32-4422-9be", location="us-central1")
gemini_model = GenerativeModel("gemini-2.5-flash")

class VerificationRequest(BaseModel):
    id_face_base64: str  # The YOLO crop output from id_info.py
    passport_photo_url: str # The user's uploaded professional passport photo
    live_photo_urls: list[str] = []  # Array of 3 live photo URLs (Empty if skipped)

# ==========================================
# HELPER FUNCTIONS
# ==========================================

async def download_image(client, url):
    """Downloads an image and returns both raw bytes and a base64 string for the UI."""
    resp = await client.get(url)
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Failed to download {url}")
    
    b64 = base64.b64encode(resp.content).decode('utf-8')
    return resp.content, f"data:image/jpeg;base64,{b64}"

def base64_to_numpy(b64_string):
    """Converts a base64 string to an OpenCV numpy array for DeepFace."""
    if "base64," in b64_string:
        b64_string = b64_string.split("base64,")[1]
    img_data = base64.b64decode(b64_string)
    np_arr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

async def select_best_frame_with_ai(image_bytes_list):
    """Uses Gemini to detect spoofing (screens/masks) and pick the best frame."""
    parts = [Part.from_data(data=b, mime_type="image/jpeg") for b in image_bytes_list]

    prompt = """
    You are an expert biometric security AI. I have provided 3 sequential frames from a live camera capture.
    TASK:
    1. Liveness Check: Are these photos of a computer screen, a printed photo, or a real live human? If spoofing is detected, reject all.
    2. Quality Check: Select the single best photo for facial recognition (good lighting, neutral expression, looking straight).
    Respond ONLY in strict JSON format:
    {
      "best_index": 0, 1, or 2 (Use -1 if ALL are spoofed or completely invalid),
      "reason": "Brief explanation of the decision",
      "statuses": ["Eval for Image 0", "Eval for Image 1", "Eval for Image 2"]
    }
    """
    parts.append(prompt)
    
    config = GenerationConfig(temperature=0.0, response_mime_type="application/json")
    response = gemini_model.generate_content(parts, generation_config=config)
    return json.loads(response.text)

# ==========================================
# THE VISUALIZATION ENDPOINT
# ==========================================

@app.post("/visualize-pipeline", response_class=HTMLResponse)
async def visualize_pipeline(request: VerificationRequest):
    
    # 1. Download the Passport Photo (Required in both modes)
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            pass_bytes, pass_b64 = await download_image(client, request.passport_photo_url)
            passport_np = base64_to_numpy(pass_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="PASSPORT_ERROR: Could not download or process the Passport Photo.")

    id_face_np = base64_to_numpy(request.id_face_base64)

    # ==============================================================
    # MODE A: DEV SKIP (0 Live Photos) -> Compare ID vs Passport
    # ==============================================================
    filtered_live_urls = [u for u in request.live_photo_urls if u and isinstance(u, str) and u.strip()]
    
    if len(filtered_live_urls) == 0:
        try:
            result = DeepFace.verify(img1_path=id_face_np, img2_path=passport_np, model_name="Facenet", enforce_detection=False)
            if not result.get("verified"):
                raise HTTPException(status_code=400, detail="PASSPORT_ERROR: The uploaded Passport photo does not match the person on the National ID.")
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=400, detail=f"PASSPORT_ERROR: Face verification failed - {str(e)}")
        
        # If we reach here, it's a success. Render simplified HTML.
        html_content = f"""
        <html>
        <head>
            <title>Validation Success (Dev Skip)</title>
            <style>
                body {{ font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px; text-align: center; }}
                .match-images {{ display: flex; justify-content: center; gap: 50px; margin-top: 20px; }}
                .match-images img {{ width: 200px; height: 200px; object-fit: cover; border: 3px solid #2ecc71; border-radius: 8px; }}
                .success {{ background-color: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin-top: 20px; display: inline-block; }}
            </style>
        </head>
        <body>
            <h2>Cryptographic FaceNet Comparison</h2>
            <div class="match-images">
                <div><h4>ID YOLO Crop</h4><img src="{request.id_face_base64}"></div>
                <div><h4>Passport Photo</h4><img src="{pass_b64}"></div>
            </div>
            <div class="success"><strong>MATCH CONFIRMED (Liveness Skipped)</strong><br>Distance: {result.get('distance')}</div>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

    # ==============================================================
    # MODE B: FULL LIVENESS (3 Live Photos) -> 3-Way Match
    # ==============================================================
    elif len(filtered_live_urls) == 3:
        async with httpx.AsyncClient(timeout=30) as client:
            tasks = [download_image(client, url) for url in filtered_live_urls]
            downloaded_data = await asyncio.gather(*tasks)
        
        raw_bytes_list = [data[0] for data in downloaded_data]
        b64_list = [data[1] for data in downloaded_data]

        # A. Gemini Liveness
        gemini_decision = await select_best_frame_with_ai(raw_bytes_list)
        best_idx = gemini_decision.get("best_index", -1)

        if best_idx == -1:
            raise HTTPException(status_code=400, detail="LIVENESS_ERROR: Spoofing detected or no valid human face found in live capture.")

        best_live_np = base64_to_numpy(b64_list[best_idx])

        # B. ID vs Live Check
        try:
            id_match = DeepFace.verify(img1_path=id_face_np, img2_path=best_live_np, model_name="Facenet", enforce_detection=False)
            if not id_match.get("verified"):
                raise HTTPException(status_code=400, detail="ID_ERROR: The person in the Live Video does not match the ID Card.")
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=400, detail="ID_ERROR: Failed to compare ID to live face.")

        # C. Passport vs Live Check
        try:
            pass_match = DeepFace.verify(img1_path=passport_np, img2_path=best_live_np, model_name="Facenet", enforce_detection=False)
            if not pass_match.get("verified"):
                raise HTTPException(status_code=400, detail="PASSPORT_ERROR: The Passport photo does not match the person in the live video.")
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=400, detail="PASSPORT_ERROR: Failed to compare Passport photo to live face.")

        # If we reach here, all 3 checks passed. Render the full HTML report.
        html_content = f"""
        <html>
        <head>
            <title>Passport Photo Validation</title>
            <style>
                body {{ font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px; }}
                .container {{ display: flex; justify-content: space-around; margin-bottom: 40px; }}
                .card {{ background: white; padding: 15px; border-radius: 8px; text-align: center; width: 30%; }}
                .card img {{ width: 100%; border-radius: 5px; }}
                .match-images {{ display: flex; justify-content: center; gap: 30px; margin-top: 20px; text-align: center; }}
                .match-images img {{ width: 180px; height: 180px; object-fit: cover; border: 3px solid #3498db; border-radius: 8px; }}
                .success {{ background-color: #d4edda; color: #155724; padding: 15px; border-radius: 5px; text-align: center; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <h2>Step 1: Anti-Spoofing & Quality Gate (Gemini 2.5)</h2>
            <p><strong>AI Reasoning:</strong> {gemini_decision.get('reason')}</p>
            <div class="container">
        """
        for i in range(3):
            status = '✅ SELECTED' if i == best_idx else '❌ REJECTED'
            html_content += f'<div class="card"><img src="{b64_list[i]}"><p>{gemini_decision["statuses"][i]}</p><h3>{status}</h3></div>'
            
        html_content += f"""
            </div>
            <h2>Step 2: 3-Way Cryptographic FaceNet Verification</h2>
            <div class="match-images">
                <div><h4>ID Card Crop</h4><img src="{request.id_face_base64}"></div>
                <div><h4>Best Live Frame</h4><img src="{b64_list[best_idx]}"></div>
                <div><h4>Passport Photo</h4><img src="{pass_b64}"></div>
            </div>
            <div class="success"><strong>ALL MATCHES CONFIRMED</strong><br>ID ↔ Live Distance: {id_match.get('distance')} | Passport ↔ Live Distance: {pass_match.get('distance')}</div>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

    else:
        raise HTTPException(status_code=400, detail="LIVENESS_ERROR: Expected exactly 0 or 3 live photos.")