/**
 * Agent Teams Tests
 *
 * Validates team configurations, member structure, and metadata
 * returned by getAvailableTeams(). Does NOT test runAgentTeam
 * because it calls external LLM APIs.
 */

import { describe, it, expect } from "vitest";
import { getAvailableTeams } from "@/lib/agent-teams";

describe("getAvailableTeams", () => {
  const teams = getAvailableTeams();

  it("should return exactly 3 teams", () => {
    expect(teams).toHaveLength(3);
  });

  it("should include war-room, content-council, and deal-room keys", () => {
    const keys = teams.map((t) => t.key);
    expect(keys).toContain("war-room");
    expect(keys).toContain("content-council");
    expect(keys).toContain("deal-room");
  });

  it("should have correct team names", () => {
    const names = teams.map((t) => t.name);
    expect(names).toContain("War Room");
    expect(names).toContain("Content Council");
    expect(names).toContain("Deal Room");
  });

  it("each team should have a lead string", () => {
    for (const team of teams) {
      expect(typeof team.lead).toBe("string");
      expect(team.lead.length).toBeGreaterThan(0);
    }
  });

  it("each team should have a members array", () => {
    for (const team of teams) {
      expect(Array.isArray(team.members)).toBe(true);
      expect(team.members.length).toBeGreaterThan(0);
    }
  });
});

describe("War Room team", () => {
  const teams = getAvailableTeams();
  const warRoom = teams.find((t) => t.key === "war-room")!;

  it("should have 4 members", () => {
    expect(warRoom.members).toHaveLength(4);
  });

  it("should have Strategic Commander as lead", () => {
    expect(warRoom.lead).toBe("Strategic Commander");
  });

  it("should include Devil's Advocate member", () => {
    expect(warRoom.members).toContain("Devil's Advocate");
  });
});

describe("Content Council team", () => {
  const teams = getAvailableTeams();
  const council = teams.find((t) => t.key === "content-council")!;

  it("should have 3 members", () => {
    expect(council.members).toHaveLength(3);
  });

  it("should have Editor-in-Chief as lead", () => {
    expect(council.lead).toBe("Editor-in-Chief");
  });
});

describe("Deal Room team", () => {
  const teams = getAvailableTeams();
  const dealRoom = teams.find((t) => t.key === "deal-room")!;

  it("should have 3 members", () => {
    expect(dealRoom.members).toHaveLength(3);
  });

  it("should have Sales Director as lead", () => {
    expect(dealRoom.lead).toBe("Sales Director");
  });
});
