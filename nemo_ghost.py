"""
Sovereign Matrix | NemoClaw Ghost Protocol v2.0 (Local Daemon)
Operating Designation: Secure Local OS Execution & Physical GUI Hijack
Architecture: Flask API + Subprocess Shell + PyAutoGUI
"""

import time
import logging
import os
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    import pyautogui
    from PIL import ImageGrab
except ImportError:
    print("[WARNING] Missing GUI control dependencies. Run: pip install pyautogui pillow")

# Configure Sovereign Telemetry
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [GHOST-NODE] %(message)s",
    handlers=[logging.StreamHandler()]
)

app = Flask(__name__)
# Allow requests from the local Next.js dev server and the production domain
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000", "https://umbra-v2.vercel.app"]}})

def capture_retina_buffer():
    """Extract physical pixel buffer from the macOS display."""
    logging.info("Capturing Retina mesh buffer...")
    try:
        screenshot = ImageGrab.grab()
        return screenshot
    except Exception as e:
        logging.error(f"Failed to capture screen: {e}")
        return None

def execute_physical_vector(action, x=None, y=None, payload=None):
    """Physically command the Apple Silicon hardware."""
    try:
        if action == "CLICK" and x and y:
            logging.info(f"Executing physical mouse hijack: CLICK at ({x}, {y})")
            pyautogui.moveTo(x, y, duration=0.3, tween=pyautogui.easeInOutQuad)
            pyautogui.click()
        elif action == "TYPE" and payload:
            logging.info(f"Injecting keystrokes: '{payload}'")
            pyautogui.write(payload, interval=0.05)
        elif action == "SCROLL":
            logging.info("Executing physical scroll vector")
            pyautogui.scroll(-500)
    except Exception as e:
        logging.error(f"Physical execution failed: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """Verify daemon status."""
    return jsonify({
        "status": "active",
        "version": "2.0.0",
        "system": os.uname().sysname if hasattr(os, 'uname') else "macOS",
        "message": "NemoClaw Ghost Protocol online."
    })

@app.route('/execute', methods=['POST'])
def execute_command():
    """Execute secure OS-level commands natively on the host machine."""
    data = request.json
    command = data.get('command')
    
    if not command:
        return jsonify({"success": False, "error": "No command provided."}), 400
        
    logging.info(f"Edge Terminal Command Received: {command}")
    
    # Intercept physical vector commands for PyAutoGUI
    if command.startswith("/physical"):
        logging.info("Triggering physical UI override...")
        execute_physical_vector("SCROLL") # Example default
        return jsonify({
            "success": True, 
            "output": "[GHOST PROTOCOL] Physical UI override executed successfully."
        })
        
    # Execute standard shell commands
    try:
        # Security Note: This runs raw commands on the user's local machine.
        # This is strictly designed for local enterprise deployment.
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=15,
            cwd=os.path.expanduser('~') # Run in user's home directory by default
        )
        
        output = result.stdout if result.returncode == 0 else result.stderr
        
        # If output is empty but command succeeded (like 'mkdir')
        if not output.strip() and result.returncode == 0:
            output = f"Command '{command}' executed successfully (no output)."
            
        return jsonify({
            "success": result.returncode == 0,
            "output": output.strip(),
            "code": result.returncode
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": "Command execution timed out."}), 408
    except Exception as e:
        logging.error(f"Execution failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    print("====================================================")
    print(" NEMOCLAW GHOST PROTOCOL API DAEMON ")
    print(" PORT: 8001 | AWAITING DASHBOARD TELEMETRY")
    print(" Press CMD+C in this terminal to abort.")
    print("====================================================")
    
    # Run the local API server
    app.run(host="127.0.0.1", port=8001, debug=False)
