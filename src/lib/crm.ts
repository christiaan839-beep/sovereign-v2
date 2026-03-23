/**
 * SOVEREIGN MATRIX CRM LAYER
 * Deep Native REST interface for HubSpot and Salesforce.
 * Allows Autonomous Agents to natively push and pull data from corporate pipelines without human data entry.
 */

// 1. HubSpot Configuration
const HUBSPOT_BASE = "https://api.hubapi.com/crm/v3";

export async function createOrUpdateHubSpotLead(email: string, properties: Record<string, string>, apiKey: string) {
  try {
    // 1. Check if contact exists
    const searchRes = await fetch(`${HUBSPOT_BASE}/objects/contacts/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }]
      })
    });
    const searchData = await searchRes.json();

    if (searchData.results && searchData.results.length > 0) {
      // Update existing
      const id = searchData.results[0].id;
      const updateRes = await fetch(`${HUBSPOT_BASE}/objects/contacts/${id}`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties })
      });
      return await updateRes.json();
    } else {
      // Create new
      const createRes = await fetch(`${HUBSPOT_BASE}/objects/contacts`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties: { email, ...properties } })
      });
      return await createRes.json();
    }
  } catch (err) {
    throw err;
  }
}

export async function advanceHubSpotDeal(dealId: string, targetStage: string, apiKey: string) {
  try {
    const updateRes = await fetch(`${HUBSPOT_BASE}/objects/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: { dealstage: targetStage } })
    });
    return await updateRes.json();
  } catch (err) {
    throw err;
  }
}

// 2. Salesforce Configuration (Basic Abstraction)
export async function createSalesforceLead(data: Record<string, string>, instanceUrl: string, accessToken: string) {
  try {
    const res = await fetch(`${instanceUrl}/services/data/v55.0/sobjects/Lead/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (err) {
    throw err;
  }
}
