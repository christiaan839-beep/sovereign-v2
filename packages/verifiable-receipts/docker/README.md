# Docker images — verifiable-receipts

Operator-friendly distribution of the OSS CLIs for environments
without Node on PATH.

## Witness daemon image

```bash
docker build -f packages/verifiable-receipts/docker/Dockerfile.witness \
  -t sovereign-matrix/witness:0.1.0 .

# Daemon mode — recommended for production witnesses
docker run -d --name sovereign-witness \
  -v /etc/sovereign/witness-key.pem:/etc/witness-key.pem:ro \
  -v sovereign-witness-state:/var/lib/witness \
  sovereign-matrix/witness:0.1.0 \
    --url https://sovereignmatrix.agency \
    --key /etc/witness-key.pem \
    --witness-id "Your Name · City" \
    --public-key-url https://your-domain.example/witness.pem \
    --state /var/lib/witness/state.json \
    --interval 3600

# CI mode — single check, structured exit code
docker run --rm \
  -v /etc/sovereign/witness-key.pem:/etc/witness-key.pem:ro \
  sovereign-matrix/witness:0.1.0 \
    --url https://sovereignmatrix.agency \
    --key /etc/witness-key.pem \
    --witness-id "Org · CI" \
    --once --json
# exit 0  → witnessed OR no-change
# exit 1  → FORK DETECTED — investigate immediately
# exit 2  → usage / network error
```

## What's in the image

- Node 22 Alpine base (~50 MB)
- `dist/` (compiled OSS package)
- `bin/witness.mjs` (the CLI itself)
- `node_modules/` pruned to runtime deps only (`@noble/post-quantum` for ML-DSA-65)

No source code, no toolchain, no tests in the final image. Multi-
stage build keeps the published image minimal; the build stage with
TypeScript compiler is discarded.

## Reproducibility

The Dockerfile pins `node:22-alpine` (rolling within the 22.x line —
pin a digest if you need strict reproducibility) and the package's
own dependencies via the npm lockfile. Every layer in the final image
maps to a Git commit + a deterministic build step. An auditor can
rebuild the image from the same SHA + Dockerfile and confirm the
SHA-256 of every layer matches.

## License

Apache-2.0 (same as the OSS package).
