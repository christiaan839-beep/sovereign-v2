# Sovereign Matrix — Browser Extension (Cook 80)

MV3 Chrome extension shell that wires the Cook 65 extension SDK to a
context-menu surface.

## Install (unpacked, for development)

1. `chrome://extensions` → toggle Developer Mode → "Load unpacked"
2. Select this `extensions/browser` directory
3. Open the extension's options page → paste your PAT + default agent slug
4. Highlight text on any page → right-click → "Run Sovereign agent on selection"

## Publishing

This shell is intentionally framework-free. To publish:

1. Replace `icon-128.png` with a real icon (PNG, 128×128 transparent)
2. Bump `manifest.json` version + zip the directory contents
3. Upload at <https://chrome.google.com/webstore/devconsole>

## Wire it to your account

The Personal Access Token (PAT) comes from
`/dashboard → API Keys → New Personal Access Token`. The extension stores
it in `chrome.storage.local`; it never leaves your machine except in the
`Authorization: Bearer …` header to your Sovereign endpoint.
