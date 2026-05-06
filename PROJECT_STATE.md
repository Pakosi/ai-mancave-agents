# WOYS Project State

## Current Architecture
- Backend: Node/Express in `backend/server.js`.
- Mock agent logic: `backend/aiProvider.js`; no OpenAI or external AI APIs.
- Company plan helpers: `backend/companyPlan.js`.
- Decision and memory helpers: `backend/decisionLog.js`.
- Agent goal and operating rhythm helpers: `backend/agentGoals.js`.
- Frontend: vanilla HTML/CSS/JS in `frontend/index.html` and `frontend/app.js`.
- Persistence: JSON files in `backend/data/messages.json`, `backend/data/tasks.json`, `backend/data/company-plan.json`, `backend/data/decision-log.json`, and `backend/data/agent-goals.json`.
- Runtime rooms: `main`, `auto`, `marketing`, `ops`, each with a short room brief.
- API includes `/api/company-plan`, `/api/decisions`, `/api/memory-events`, `/api/agent-goals`, and `/api/operating-rhythm`.

## Agents
- Agents: `host`, `assistant`, `sales`, `strategist`, `researcher`, `builder`, `analyst`, `manager`.
- Each agent has public metadata: `id`, `name`, `role`, `expertise`, `preferredRooms`, `behaviorStyle`, `taskTendencies`, and `allowedActions`.
- Agent replies remain rule-based and short, using room brief context and agent specialization.

## Autonomous Behavior
- The autonomous loop rotates across rooms and avoids repeating the same speaker back-to-back where possible.
- Speaker selection favors agents whose `preferredRooms` include the active room.
- Active task selection favors tasks assigned to, matching tendencies of, or matching plan priorities for the acting agent.
- Agents can create or advance tasks only when their `allowedActions` permit it.
- Specialized task drafts reflect agent tendencies, such as research, planning, building, analysis, revenue validation, and coordination.
- Strategist, analyst, builder, researcher, sales, host, and manager feed updates into the shared company plan.
- Strategist, manager, analyst, and host can create deterministic decision log entries during autonomous activity.
- Completed tasks create high-importance memory events.
- Autonomous activity follows a lightweight rhythm: observe, plan, execute, review.
- Agent goals influence task selection and task creation context.

## Company Plan
- Tracks current objective, active priorities, key risks, next recommended actions, and recent decisions.
- Manager and host occasionally add coordination decisions.
- Strategist influences priorities; analyst influences risks; builder, researcher, and sales influence next actions.
- Autonomous task creation includes the current objective so tasks stay tied to the plan.
- Recent decisions can sync from the decision log.

## Decision Log And Memory
- Decisions include id, timestamp, room, agent, title, summary, reason, impact, and optional related task id.
- Memory events include id, timestamp, room, type, summary, and importance.
- Both endpoints support optional `roomId` filtering.

## Agent Goals And Rhythm
- Each agent has a JSON-backed goal with current goal, focus area, success criteria, active room, last update, and status.
- Manager and host can update goals during autonomous activity.
- Review-phase goal updates can create memory events.
- Operating rhythm exposes current phase and cycle number.

## Frontend
- The agent selector is populated from `/api/agents` and includes specialized agents.
- Room agent nodes show the agent name and role with stable lightweight positioning.
- The UI shows room brief, activity feed, tasks, Company Plan, Agent Goals, and Decisions / Memory panels without adding frameworks.

## Tests
- Backend: `cd backend && npm test`.
- Frontend: `node --test frontend/app.test.js`.
- Syntax checks: `node --check frontend/app.js`, `node --check backend/server.js`, `node --check backend/aiProvider.js`.
