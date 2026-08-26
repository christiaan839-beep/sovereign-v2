# Python agents

Standalone Python agents. Not bundled into the Next.js build — they run as their
own processes (see `Dockerfile`, `Dockerfile.nemoclaw`, and the `ghost-protocol` /
`nemoclaw-daemon` targets in `.claude/launch.json`).

## Setup

```bash
cd server/python-agents
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

## Why the virtualenv is not in the repository

It used to be. 4,659 files, 92 MB — 70% of the whole repository by file count.

Three reasons it is gone:

1. **Licensing.** It vendored third-party `site-packages` into a repository marked
   "All rights reserved" whose Agency Licence explicitly permits handing the source
   to a client. That is redistributing other people's packages without their notices.
2. **It did not work anywhere else.** The compiled artefacts were built for
   python3.12 on one machine. A buyer on a different OS or Python version got a
   broken environment, not a working one.
3. **Clone cost.** Everyone paid 92 MB to receive files they had to replace.

`requirements.txt` is the source of truth. Recreate the environment; do not commit it.
