# CRM Rule Builder

A drag-and-drop visual business rule builder for the CRM platform. Designed as a workflow designer where rules are assembled by connecting typed nodes on a canvas.

## Overview

Rules execute automatically on two trigger types:
- **SQS Trigger** — a message arrives on a configured AWS SQS queue carrying an entity payload
- **Record Save** — an entity is persisted via the CRM API

In both cases the full entity JSON is the **scope object** available to every node in the rule.

## Rule Types

### 1. Set Value Rule
Evaluates a condition against the scope object, then writes one or more field values back to the entity and persists the change.

```
[SQS / Record Save Trigger] → [Condition] → [Set Value] → [End]
                                           ↘ (false) → [End]
```

### 2. Send Notification Rule
Evaluates a condition against the scope object, then sends a notification (Email, SMS, Push, or Webhook).

```
[SQS / Record Save Trigger] → [Condition] → [Notification] → [End]
                                           ↘ (false) → [End]
```

## Node Types

| Node | Purpose | Ports |
|------|---------|-------|
| **Trigger** | Entry point — defines what fires the rule | 1 output |
| **Condition** | Evaluates a field expression; branches TRUE / FALSE | 1 input · 2 outputs |
| **Set Value** | Writes field assignments to the scope object and optionally saves the entity | 1 input · 1 output |
| **Notification** | Dispatches a notification via the chosen channel | 1 input · 1 output |
| **End** | Terminates the flow branch | 1 input |

## Canvas Interactions

| Action | How |
|--------|-----|
| Add a node | Drag from the left palette onto the canvas |
| Move a node | Click and drag the node header |
| Connect nodes | Drag from an **output port** (bottom) to an **input port** (top) of another node |
| Delete a connection | Right-click the connection line → Delete |
| Delete a node | Click the × icon on the node (also removes its connections) |
| Pan the canvas | Hold `Alt` + drag, or middle-mouse drag |
| Zoom | Mouse-wheel or toolbar ± buttons |
| Configure a node | Click the node to open the Properties panel on the right |

## Supported Condition Operators

`equals` · `not_equals` · `greater_than` · `less_than` · `greater_than_or_equal` · `less_than_or_equal` · `contains` · `starts_with` · `ends_with` · `is_null` · `is_not_null`

Conditions support **multiple clauses** combined with `AND` / `OR`.

## Expression Syntax (Set Value)

Values in Set Value nodes can be:
- A **literal** — `"Active"`, `42`, `true`
- A **field reference** — `{{status}}`, `{{owner.email}}`
- A **template string** — `"Hello {{firstName}} {{lastName}}"`

## Getting Started

```bash
# Frontend
cd frontend && npm install && ng serve

# Database (MySQL 8.0+): apply the schema scripts in order
for f in database/mysql/0*.sql; do mysql -u <user> -p <database> < "$f"; done

# Backend
cd backend && npm install && npm run build && npm start
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design, [API.md](./API.md) for the REST endpoints and [SLA.md](./SLA.md) for SLA tracking.
