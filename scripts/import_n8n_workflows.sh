#!/bin/bash

# Sovereign Matrix: Automated Workflows Ingestion
echo "=================================================="
echo "    ARMING SWARM: Local n8n Logic Import"
echo "=================================================="

CONTAINER_NAME="sovereign-n8n"

echo "[1/2] Importing Social Media Agent Workflows..."
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/social-media-agent/workflows/full_funnel.json
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/social-media-agent/workflows/instagram_auto_post.json
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/social-media-agent/workflows/youtube_auto_upload.json

echo "[2/2] Importing Data Flywheel Workflows..."
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/flywheel/aggregator.json
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/flywheel/apollo_enrichment.json
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/flywheel/pinecone_memory.json
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/flywheel/pinecone_query.json
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/flywheel/trend_scout.json
docker exec $CONTAINER_NAME n8n import:workflow --input=/skills/flywheel/twilio_followup.json

echo ""
echo "✅ All 9 cognitive nodes successfully injected."
echo "=================================================="
