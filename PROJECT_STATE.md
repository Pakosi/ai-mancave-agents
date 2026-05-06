# AI Mancave HQ Project State

## Current Architecture
- Backend: Node/Express in `backend/server.js`.
- Mock agent logic: `backend/aiProvider.js`; no OpenAI or external AI APIs.
- Company plan helpers: `backend/companyPlan.js`.
- Decision and memory helpers: `backend/decisionLog.js`.
- Agent goal and operating rhythm helpers: `backend/agentGoals.js`.
- Business idea helpers: `backend/businessIdeas.js`.
- Frontend: vanilla HTML/CSS/JS in `frontend/index.html` and `frontend/app.js`.
- Persistence: JSON files in `backend/data/messages.json`, `backend/data/tasks.json`, `backend/data/company-plan.json`, `backend/data/decision-log.json`, `backend/data/agent-goals.json`, and `backend/data/business-ideas.json`.
- Runtime rooms: AI Mancave HQ, Automation Lab, Strategy Room, and Operations Desk, backed by the internal ids `main`, `auto`, `marketing`, and `ops`.
- API includes `/api/company-plan`, `/api/business-ideas`, `/api/decisions`, `/api/memory-events`, `/api/agent-goals`, `/api/operating-rhythm`, and markdown export routes under `/api/exports/...`.
- Provider boundaries exist for mock-first AI, market data, and research adapters. They currently return deterministic local output and are ready for future real integrations.

## Agents
- Visible roster: `CEO / Principal`, `Trading Agent`, `AI Automation Agent`, `Arbitrage Agent`, `Research Agent`, `Builder Agent`, and `Analyst Agent`.
- Internal coordinator logic still exists behind the scenes, but it is not shown in the public roster.
- Each agent has public metadata: `id`, `name`, `role`, `expertise`, `preferredRooms`, `behaviorStyle`, `taskTendencies`, and `allowedActions`.
- Agent replies remain rule-based and short, using room brief context and agent specialization.

## Autonomous Behavior
- The autonomous loop rotates across rooms and avoids repeating the same speaker back-to-back where possible.
- Speaker selection favors agents whose `preferredRooms` include the active room.
- Active task selection favors tasks assigned to, matching tendencies of, or matching plan priorities for the acting agent.
- Agents can create or advance tasks only when their `allowedActions` permit it.
- Specialized task drafts reflect agent tendencies, such as research, planning, building, analysis, revenue validation, and coordination.
- Arbitrage, analyst, builder, research, trading, and CEO/Principal feedback feed updates into the shared company plan.
- CEO/Principal, arbitrage, analyst, and the internal coordinator can create deterministic decision log entries during autonomous activity.
- Completed tasks create high-importance memory events.
- Autonomous activity follows a lightweight rhythm: observe, plan, execute, review.
- Agent goals influence task selection and task creation context.

## Company Plan
- Tracks current objective, active priorities, key risks, next recommended actions, and recent decisions.
- CEO/Principal occasionally adds coordination decisions.
- Arbitrage influences priorities; analyst influences risks; builder, research, and trading influence next actions.
- Autonomous task creation includes the current objective so tasks stay tied to the plan.
- Recent decisions can sync from the decision log.

## Decision Log And Memory
- Decisions include id, timestamp, room, agent, title, summary, reason, impact, and optional related task id.
- Memory events include id, timestamp, room, type, summary, and importance.
- Both endpoints support optional `roomId` filtering.

## Agent Goals And Rhythm
- Each agent has a JSON-backed goal with current goal, focus area, success criteria, active room, last update, and status.
- CEO/Principal can update goals during autonomous activity.
- Review-phase goal updates can create memory events.
- Operating rhythm exposes current phase and cycle number.

## Frontend
- The agent selector is populated from `/api/agents` and includes specialized agents.
- Room agent nodes now use simple full-body stylized characters with stable positioning, while preserving names, roles, and speech bubbles.
- Phase 2B added lightweight CSS idle and talking animations: breathing, sway, head drift, body lift, and glow pulses.
- Phase 2C adds lightweight ambient movement between predefined HQ positions, with the host acting as the main patrol/check-in agent.
- Phase 2D adds visible workstation zones and role-based working poses for command, research, builder, analyst, automation, trading, and lounge areas.
- Phase 3A ties station choice and animation intensity to current tasks, rhythm phase, decisions, and handoff pressure.
- The UI shows room brief, activity feed, tasks, Company Plan, Agent Goals, and Decisions / Memory panels without adding frameworks.
- The frontend is visually collapsed into a single persistent HQ room and no longer exposes room switching in the visible shell.
- Phase 2A introduced fuller static agent characters; Phase 2B layered idle/talking motion, Phase 2C added ambient walking, Phase 2D added workstation interaction visuals, and Phase 3A connected the station behavior to live simulation state without adding routing or pathfinding.
- Visible agent motion now keeps each agent near a preferred home station, with the CEO/Principal checking in only when blocked tasks or similar pressure justify it.
- The room art was pushed a little closer to a stylized luxury mancave with warmer panels, stronger station contrast, and transparent character containers so avatars no longer sit on dark blocks.
- The HQ room visuals now lean more pixel/stylized: sharper panels, blockier furniture, tiled floor depth, and chunkier agent silhouettes while preserving layout and animations.
- Visual readability polish now leans into a cleaner pixel/stylized language with stronger depth separation, clearer station labels, more readable speech bubbles, and subtle ambient station activity like blinking monitors, scrolling bars, and panel glow.
- Phase 3B adds explicit zone metadata for every HQ station and surfaces each zone's purpose in-room and on agent hover/detail text without changing motion logic.
- Phase 3C makes movement more intentional with route reasons, task/idea-driven zone switches, host patrol priorities, and a simple cooldown/dwell guard against rapid station hopping.
- Phase 3D adds short visible interaction events for station work and check-ins, shown in-room and promoted into the activity feed when important.
- Stabilization pass tightened label density and card readability across the HQ scene, digest, ideas, command result, and interaction event surfaces without adding new systems.

## Agent Handoffs And Task Ownership
- Tasks have five new fields: `ownerAgentId`, `assignedByAgentId`, `handoffReason`, `lastHandoffAt`, and optional `blockedReason`.
- `ownerAgentId` defaults to `assignedAgentId` on creation; `assignedByAgentId` records who created the task.
- Task selection priority: manager picks blocked tasks first, then owned tasks (`ownerAgentId === agent.id`), then specialization/plan/goal tiers.
- `findBestAgentForTask()` matches task text against agent `taskTendencies` to find the strongest fit.
- `handoffTask()` updates ownership, sets `handoffReason` and `lastHandoffAt`, writes a feed entry, and creates a memory event for important handoffs.
- `maybeHandoffAutonomousTask()` is called each autonomous cycle: coordinators (manager/host) may reassign during review; any agent may handoff to a better fit outside execute phase; manager clears blocked tasks via handoff.
- `PATCH /api/tasks/:taskId` now also accepts `blockedReason` (string or null) to mark or unmark a task as blocked.
- `PATCH /api/tasks/:taskId/handoff` allows manager or host to reassign a task; body: `{ actingAgentId, toAgentId, reason }`. Creates a feed entry and memory event.
- Existing tasks without new fields are normalized on read via `normalizeTasks()`.

## Business Ideas
- Business ideas are JSON-backed backend records with title, category, description, viability scores, status, ownership, next action, and notes.
- `backend/businessIdeas.js` provides create, update, normalize, and ranking helpers.
- `GET /api/business-ideas` returns ranked ideas from the JSON store.
- Phase 4A stopped at the backend model; Phase 4B adds compact live idea cards in the HQ sidebar, with status highlighting for promising, building, and killed ideas.
- Phase 4C lets autonomous agents create and refine ideas, while host/manager review and rank them during the loop.
- Phase 4D adds a JSON-backed CEO digest with ranked ideas, recent changes, risk and next-step summaries, exposed at `/api/ceo-digest` and shown in the sidebar.

## Command Layer
- Phase 5A adds a lightweight command parser and `POST /api/commands`.
- Supported commands include `summarize today`, `focus trading`, `focus automation`, `rank ideas`, `kill weak ideas`, and `prioritize [category]`.
- Commands update company plan, agent goals, business ideas, CEO digest, and feed messages in a deterministic way.
- The frontend routes command-like input through the command endpoint and shows a compact response under the input.

## Exports
- Markdown exports are available for the CEO digest, ranked business ideas, and single idea reports.
- The frontend shows exported markdown in a compact sidebar panel, includes copy success/failure feedback, and labels loaded idea reports by title.
- The HQ sidebar keeps CEO Digest and Business Ideas visible, while lower-priority panels sit in compact collapsible sections for commands, exports, plan, goals, and decisions/memory.

## Provider Boundaries
- `backend/aiProvider.js` exposes a mock AI provider factory.
- `backend/marketProvider.js` exposes a deterministic market snapshot provider.
- `backend/researchProvider.js` exposes a deterministic research provider.
- Server logic uses these providers through local mock implementations only.

## Frontend
- The agent selector is populated from `/api/agents` and includes specialized agents.
- Room agent nodes show the agent name and role with stable lightweight positioning.
- The UI shows room brief, activity feed, tasks, Company Plan, Agent Goals, and Decisions / Memory panels without adding frameworks.
- Task cards show the current owner (with `assigned → owner` notation when handed off) and a blocked-reason indicator when set.
- Handoff feed messages appear in the regular activity feed.

## Tests
- Backend: `cd backend && npm test`.
- Frontend: `node --test frontend/app.test.js`.
- Syntax checks: `node --check frontend/app.js`, `node --check backend/server.js`, `node --check backend/aiProvider.js`.
