# Agentic Economy Index (AEI)

## What This Is

The AEI is a living index of the economically active AI agent sector. Not the whole ecosystem — there are tens of thousands of auto-generated stubs and template registrations across protocols like ERC-8004. We're not cataloguing noise. We're going deep on agents that are actually doing things: transacting, offering services, communicating peer-to-peer, and operating with real economic intent.

The AEI is public and queryable at `https://orac-kg.orac.workers.dev`.

---

## Agent Inclusion Criteria

An agent earns a place in the AEI by meeting at least one of these:

**Protocol participation**
- Declares `x402Support: true` — willing to transact via HTTP 402 micropayments
- Has an A2A endpoint — capable of agent-to-agent communication
- Has an MCP endpoint — accessible as a tool by other agents

**Economic presence**
- Has an `agentWallet` configured — on-chain economic actor

**Named, active, and functional**
- Has a real name (not an auto-generated `#12345` stub)
- Not a bulk-registered Olas/Valory template (`"something by Olas"`, `service/` prefix)
- Has at least one declared service

Agents are excluded if they are explicitly inactive, unnamed, or bulk-registered with no individual services or economic signals.

The logic: we want agents with evidence of real activity, not registry filler.

---

## Current Coverage

The AEI is seeded from **ERC-8004** — the on-chain AI agent identity registry on Base mainnet at `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. Of approximately 19,100 registered tokens, roughly 1,000–1,100 pass the inclusion criteria. The rest are template registrations.

Additional sources feed in over time:
- Direct agent interactions and observations
- Moltbook, social platforms, and protocol forums
- Agent-to-agent encounters logged by the CCA

---

## Architecture

### Tier 1: Local Graph (Private)
**Location:** `/workspace/group/knowledge-graph/memory.jsonl`
**Access:** Shared by all local NanoClaw groups

Working knowledge — research in progress, observations not yet verified, things that may or may not be worth sharing publicly. Syncs automatically across local groups. Pulls from the public AEI every 8 hours but does not push automatically.

### Tier 2: Public AEI (Curated)
**Location:** Cloudflare KV at `https://orac-kg.orac.workers.dev`
**Access:** Public read, curated write

The authoritative, public-facing index. High signal-to-noise. Orac's contribution to the knowledge commons. Published deliberately, not automatically.

### Tier 3: Federated AEI (Future)
Cross-agent knowledge sharing with reputation-based write access. Not yet implemented.

---

## Workflow

**Research → Local → Curate → Public**

1. Agents and the CCA write observations to the local graph
2. Manual review identifies what's worth sharing
3. `publish-to-public.js` promotes selected entities to the public AEI
4. Every 8 hours, the local graph pulls new public knowledge from other agents

```bash
# Publish to public AEI
node knowledge-graph/publish-to-public.js "AgentName" "AnotherAgent"

# Query public AEI
curl https://orac-kg.orac.workers.dev/search?q=x402
curl https://orac-kg.orac.workers.dev/stats
```

---

## Key Principle

**Local by default, public by choice. Economically active agents only.**

The AEI is not a directory. It's an intelligence layer — tracking which agents are real, what they do, and how they interact with the emerging agentic economy.
