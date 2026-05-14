import base64
import json
import httpx
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import vertexai
from vertexai.generative_models import GenerativeModel, Part
from deepface import DeepFace
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig

app = FastAPI(title="High-Assurance Passport Photo Validation")

# Initialize Gemini for Anti-Spoofing & Quality Gate
vertexai.init(project="project-7648918a-4e32-4422-9be", location="us-central1")
gemini_model = GenerativeModel("gemini-2.5-flash")

class VerificationRequest(BaseModel):
    id_face_base64: str  # The YOLO crop output from id_info.py
    live_photo_urls: list[str]  # Array of 3 live photo URLs from Supabase

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
    """
    Uses Gemini to detect spoofing (screens/masks) and pick the best frame.
    """
    parts = []
    for img_bytes in image_bytes_list:
        parts.append(Part.from_data(data=img_bytes, mime_type="image/jpeg"))

    prompt = """
    You are an expert biometric security AI. I have provided 3 sequential frames from a live camera capture.
    
    TASK:
    1. Liveness Check: Are these photos of a computer screen, a printed photo, or a real live human? If spoofing is detected, reject all.
    2. Quality Check: Select the single best photo for facial recognition (good lighting, neutral expression, looking straight, no blur).
    
    Respond ONLY in strict JSON format:
    {
      "best_index": 0, 1, or 2 (Use -1 if ALL are spoofed or completely invalid),
      "reason": "Brief explanation of the decision",
      "statuses": [
         "Evaluation for Image 0 (e.g., Rejected: Blurry)",
         "Evaluation for Image 1 (e.g., Accepted: Best clarity and lighting)",
         "Evaluation for Image 2 (e.g., Rejected: Looking away)"
      ]
    }
    """
    parts.append(prompt)
    
    # Force zero creativity and strict JSON output to prevent parser crashes
    config = GenerationConfig(
        temperature=0.0,
        response_mime_type="application/json"
    )
    
    # We pass the config to the generation call
    response = gemini_model.generate_content(parts, generation_config=config)
    
    # Safely load the JSON without needing the .replace() string cleanup
    return json.loads(response.text)

# ==========================================
# THE VISUALIZATION ENDPOINT
# ==========================================

@app.post("/visualize-pipeline", response_class=HTMLResponse)
async def visualize_pipeline(request: VerificationRequest):
    if len(request.live_photo_urls) != 3:
        raise HTTPException(status_code=400, detail="Exactly 3 live photos are required.")

    # 1. Download all 3 live photos simultaneously
    async with httpx.AsyncClient(timeout=30) as client:
        tasks = [download_image(client, url) for url in request.live_photo_urls]
        import asyncio
        downloaded_data = await asyncio.gather(*tasks)
    
    raw_bytes_list = [data[0] for data in downloaded_data]
    b64_list = [data[1] for data in downloaded_data]

    # 2. Ask Gemini to pick the best one and detect spoofs
    gemini_decision = await select_best_frame_with_ai(raw_bytes_list)
    best_idx = gemini_decision.get("best_index", -1)

    # 3. If a valid face was found, run FaceNet Cryptographic Match
    match_result = {"verified": False, "distance": "N/A", "threshold": "N/A"}
    if best_idx != -1:
        best_live_np = base64_to_numpy(b64_list[best_idx])
        id_face_np = base64_to_numpy(request.id_face_base64)
        
        try:
            # We use FaceNet to comply with the < 2.0% FRR requirement
            result = DeepFace.verify(
                img1_path=id_face_np, 
                img2_path=best_live_np, 
                model_name="Facenet",
                enforce_detection=False # YOLO already cropped the ID face
            )
            match_result = result
        except Exception as e:
            match_result["error"] = str(e)

    # 4. Generate the HTML Pipeline Visualization
    html_content = f"""
    <html>
    <head>
        <title>Passport Photo Validation</title>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px; }}
            h2 {{ color: #2c3e50; }}
            .container {{ display: flex; justify-content: space-around; margin-bottom: 40px; }}
            .card {{ background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; width: 30%; }}
            img {{ max-width: 100%; border-radius: 5px; margin-bottom: 10px; }}
            .status-cross {{ color: red; font-weight: bold; font-size: 24px; }}
            .status-tick {{ color: green; font-weight: bold; font-size: 24px; }}
            .match-panel {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }}
            .match-images {{ display: flex; justify-content: center; gap: 50px; margin-top: 20px; }}
            .match-images img {{ width: 200px; height: 200px; object-fit: cover; border: 3px solid #3498db; }}
            .result-text {{ font-size: 20px; margin-top: 20px; padding: 10px; border-radius: 5px; }}
            .success {{ background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }}
            .fail {{ background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }}
        </style>
    </head>
    <body>
        <h2>Step 1: Anti-Spoofing & Quality Gate (Gemini 2.5)</h2>
        <p><strong>AI Reasoning:</strong> {gemini_decision.get('reason')}</p>
        
        <div class="container">
    """
    
    # Render the 3 live photos with ticks/crosses
    for i in range(3):
        status_icon = '<div class="status-tick">✅ SELECTED</div>' if i == best_idx else '<div class="status-cross">❌ REJECTED</div>'
        html_content += f"""
            <div class="card">
                <img src="{b64_list[i]}" alt="Live Frame {i}">
                <p>{gemini_decision['statuses'][i]}</p>
                {status_icon}
            </div>
        """

    html_content += """
        </div>
        <h2>Step 2: Cryptographic FaceNet Comparison (DeepFace)</h2>
        <div class="match-panel">
    """

    if best_idx != -1:
        match_status_class = "success" if match_result.get("verified") else "fail"
        match_text = "MATCH CONFIRMED" if match_result.get("verified") else "MATCH FAILED"
        
        html_content += f"""
            <div class="match-images">
                <div>
                    <h4>ID YOLO Crop</h4>
                    <img src="{request.id_face_base64}" alt="ID Face">
                </div>
                <div>
                    <h4>Best Live Frame</h4>
                    <img src="{b64_list[best_idx]}" alt="Live Face">
                </div>
            </div>
            <div class="result-text {match_status_class}">
                <strong>{match_text}</strong> <br>
                FaceNet Distance: {match_result.get('distance', 'N/A')} (Threshold: {match_result.get('threshold', 'N/A')})
            </div>
        """
    else:
        html_content += """
            <div class="result-text fail">
                <strong>PROCESS ABORTED</strong> <br>
                No valid live photo found. Possible spoofing attempt detected.
            </div>
        """

    html_content += """
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)