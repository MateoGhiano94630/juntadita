import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 escribe AGENTS.md y CLAUDE.md en la raíz en cada `next dev`.
  // No son parte del alcance de este MVP, así que se apagan.
  agentRules: false,
};

export default nextConfig;
