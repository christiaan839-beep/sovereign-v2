#!/bin/bash

echo "=============================================="
echo " SOVEREIGN MATRIX: OPENCLAW MAC NODE INSTALLER"
echo "=============================================="
echo ""
echo "[1/4] Checking for actual physical GPU architecture..."
if [[ $(uname -m) == 'arm64' ]]; then
  echo "✅ Apple Silicon Detected. Neural Engine available."
else
  echo "⚠️ Intel Mac Detected. Performance will be degraded."
fi

echo ""
echo "[2/4] Installing Ollama (God-Brain Local Runner)..."
if ! command -v ollama &> /dev/null; then
  curl -L https://ollama.ai/download/Ollama-darwin.zip -o Ollama-darwin.zip
  unzip Ollama-darwin.zip
  mv Ollama.app /Applications
  rm Ollama-darwin.zip
  echo "✅ Ollama installed into /Applications. Please open it to start the daemon."
else
  echo "✅ Ollama is already installed."
fi

echo ""
echo "[3/5] Pulling NVIDIA Nemotron & Qwen2.5-Coder Open Models..."
if command -v ollama &> /dev/null; then
  echo "Executing physical pull from God-Brain Hub..."
  ollama pull nemotron-mini || ollama pull llama3
  echo "Pulling Qwen2.5-Coder (Open-Source Claude equivalent)..."
  ollama pull qwen2.5-coder:7b
else
  echo "⚠️ Skipping pull until Ollama is started manually."
fi

echo ""
echo "[4/5] Activating Local OS Dependencies (PyAutoGUI, Aider-Chat, Playwright, ChromaDB)..."
pip install fastapi uvicorn pyautogui playwright chromadb ollama aider-chat
playwright install chromium

echo ""
echo "[5/5] Local Node Bridge"
echo "The local edge bridge (openclaw_payload.py) was removed: it exposed an"
echo "unauthenticated HTTP endpoint that executed arbitrary shell commands on the host."
echo "If you need a local bridge, build one that authenticates every request and"
echo "dispatches to a fixed, non-shell command allowlist."
echo ""
echo "SYSTEM READY."
