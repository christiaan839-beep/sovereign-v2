#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — MCP Server
 *
 * Exposes 6 tools to Claude for operating the Sovereign Matrix platform:
 *
 *   1. sovereign_health      — Check platform health and DB connectivity
 *   2. sovereign_run_playbook — Execute a pre-built playbook by ID
 *   3. sovereign_list_playbooks — List all available playbooks
 *   4. sovereign_run_agent    — Execute any single agent with a prompt
 *   5. sovereign_usage        — Get usage metrics for the current billing period
 *   6. sovereign_api_catalog  — Get the full platform capability manifest
 *
 * Configuration:
 *   SOVEREIGN_BASE_URL — The base URL of the platform (default: https://sovereignmatrix.agency)
 *   SOVEREIGN_API_KEY  — API key for authenticated requests (optional for health/catalog)
 */
export {};
