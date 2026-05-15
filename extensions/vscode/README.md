# Sovereign Matrix — VS Code Extension (Cook 80)

Zero-dep VS Code extension shell. Runs Sovereign Matrix agents on
your editor selection and shows the result + cryptographic receipt id
in an output channel.

## Install (development)

```bash
cd extensions/vscode
code --install-extension sovereign-matrix-0.1.0.vsix
```

Or open this folder in VS Code → press F5 to launch an Extension
Development Host.

## Commands

| Command palette                        | What                                         |
| -------------------------------------- | -------------------------------------------- |
| `Sovereign: Run agent on selection`    | POSTs the selection to /api/agents/<slug>    |
| `Sovereign: Set Personal Access Token` | Stores the PAT in VS Code SecretStorage      |
| `Sovereign: Set default agent slug`    | Updates `sovereign.defaultAgent` in settings |

Default keybinding: `Ctrl+Alt+S` (macOS: `Cmd+Alt+S`) when there is a selection.

## Settings

| Key                      | Default                          | Notes                              |
| ------------------------ | -------------------------------- | ---------------------------------- |
| `sovereign.apiBase`      | `https://sovereignmatrix.agency` | Override for self-hosted clusters  |
| `sovereign.defaultAgent` | `smart-router`                   | Any agent in the platform registry |

## Publishing

```bash
npm install -g @vscode/vsce
vsce package
```
