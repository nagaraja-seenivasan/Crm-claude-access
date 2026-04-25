# Architecture — CRM Rule Builder

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17 · PrimeNG 17 · Angular CDK · strict TypeScript |
| Backend | Node.js · LoopBack 4 · strict TypeScript |
| Message queue | AWS SQS |
| Database | MongoDB (configurable via LoopBack datasource) |

## Directory Layout

```
Crm-claude-access/
├── docs/                         ← project documentation (this folder)
├── frontend/                     ← Angular application
│   └── src/app/
│       └── rule-builder/
│           ├── models/           ← shared TypeScript interfaces
│           ├── services/         ← HTTP + state services
│           └── components/
│               ├── rule-builder-page/   ← page shell
│               ├── node-palette/        ← draggable node list
│               ├── rule-canvas/         ← SVG canvas + node rendering
│               └── node-properties/     ← right-side config panel
└── backend/                      ← LoopBack 4 API
    └── src/
        ├── models/               ← Rule, RuleExecutionLog entities
        ├── controllers/          ← REST endpoints
        ├── repositories/         ← data access
        ├── services/             ← rule engine, notifications, SQS consumer
        ├── types/                ← shared TypeScript types
        └── datasources/          ← DB connection config
```

## Rule Data Model

```
RuleDefinition
├── id: string
├── name: string
├── entityType: string            ← e.g. "Lead", "Account", "Deal"
├── isActive: boolean
├── triggerTypes: TriggerType[]   ← SQS | RECORD_SAVE
├── nodes: RuleNode[]
│   ├── id: string (UUID)
│   ├── type: NodeType
│   ├── label: string
│   ├── position: { x, y }       ← canvas coordinates
│   └── data: NodeData           ← type-specific config (see below)
└── connections: NodeConnection[]
    ├── id: string (UUID)
    ├── sourceNodeId / sourcePortId
    ├── targetNodeId / targetPortId
    └── label?: "TRUE" | "FALSE"
```

### NodeData variants

```typescript
TriggerNodeData   → { triggerType, entityType, sqsQueueName? }
ConditionNodeData → { field, operator, value, logicalOperator?, conditions[] }
SetValueNodeData  → { assignments[{ targetField, value, isExpression }], saveEntity }
NotificationData  → { channel, templateId, subject?, recipientField, additionalRecipients? }
```

## Rule Engine Execution (Backend)

```
Incoming payload (SQS message or record-save hook)
        │
        ▼
RuleEngineService.executeForEntity(entityType, scope)
        │  loads all active rules matching entityType + triggerType
        ▼
RuleEngineService.executeRule(rule, scope)
        │  walks the node graph depth-first
        ▼
  ┌─────┴──────────────────────────────────────────────────────┐
  │  trigger → evaluate → branch on TRUE/FALSE                  │
  │      ├─ set-value: mutate scope, optionally save entity     │
  │      ├─ notification: dispatch via NotificationService      │
  │      └─ end: terminate branch                               │
  └─────────────────────────────────────────────────────────────┘
        │
        ▼
RuleExecutionLog persisted (ruleId, entityId, nodeTrace, outcome)
```

## SQS Integration

The `SqsConsumerService` polls the configured queue on startup:

```
SQS Queue  →  SqsConsumerService.poll()
                    │
                    ▼
           { entityType, entityId, payload }
                    │
                    ▼
           RuleEngineService.executeForEntity(entityType, payload)
```

Queue URL and polling interval are set in `backend/.env`.

## Frontend Canvas Architecture

The canvas is a **hybrid HTML + SVG** approach:
- Nodes are absolutely-positioned `<div>` elements (rendered via `*ngFor`)
- Connections are `<path>` elements in a full-canvas `<svg>` overlay
- Bezier control points are computed from port positions at render time
- Dragging nodes uses raw `mousedown/mousemove/mouseup` events (no library needed)
- Palette-to-canvas transfer uses the HTML5 native drag-and-drop API

No third-party diagram library is required — the canvas is ~300 lines of TypeScript.

## Security Notes

- All REST endpoints require a valid JWT bearer token (middleware placeholder in `application.ts`)
- Rule expressions do **not** use `eval()` — the expression evaluator is a regex-based template interpolator
- SQS message bodies are validated against a JSON schema before execution
