# API Reference — CRM Rule Builder

Base URL: `http://localhost:3000`

All endpoints accept and return `application/json`. Authentication header: `Authorization: Bearer <token>`.

---

## Rules

### `GET /rules`
List all rules.

**Query params**
| Param | Type | Description |
|-------|------|-------------|
| `entityType` | string | Filter by entity type |
| `isActive` | boolean | Filter by active state |

**Response `200`**
```json
[
  {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Set Lead Status on High Value",
    "entityType": "Lead",
    "isActive": true,
    "triggerTypes": ["RECORD_SAVE"],
    "nodes": [...],
    "connections": [...],
    "createdAt": "2026-04-25T10:00:00Z",
    "updatedAt": "2026-04-25T10:00:00Z"
  }
]
```

---

### `POST /rules`
Create a new rule.

**Request body**
```json
{
  "name": "Notify on Deal Won",
  "description": "Send email when deal status is Won",
  "entityType": "Deal",
  "isActive": true,
  "triggerTypes": ["RECORD_SAVE", "SQS"],
  "nodes": [
    {
      "id": "node-1",
      "type": "trigger",
      "label": "Record Save",
      "position": { "x": 200, "y": 100 },
      "data": { "triggerType": "RECORD_SAVE", "entityType": "Deal" }
    },
    {
      "id": "node-2",
      "type": "condition",
      "label": "Status = Won",
      "position": { "x": 200, "y": 250 },
      "data": { "field": "status", "operator": "equals", "value": "Won" }
    },
    {
      "id": "node-3",
      "type": "notification",
      "label": "Email Team",
      "position": { "x": 200, "y": 420 },
      "data": {
        "channel": "EMAIL",
        "templateId": "deal-won-template",
        "recipientField": "owner.email"
      }
    }
  ],
  "connections": [
    { "id": "c1", "sourceNodeId": "node-1", "sourcePortId": "output", "targetNodeId": "node-2", "targetPortId": "input" },
    { "id": "c2", "sourceNodeId": "node-2", "sourcePortId": "output-true", "targetNodeId": "node-3", "targetPortId": "input", "label": "TRUE" }
  ]
}
```

**Response `200`** — created rule with generated `id`.

---

### `GET /rules/{id}`
Get a single rule by ID.

---

### `PATCH /rules/{id}`
Update a rule. Accepts a partial rule body.

---

### `DELETE /rules/{id}`
Delete a rule by ID.

---

### `PATCH /rules/{id}/toggle`
Toggle `isActive` on/off.

**Response `200`**
```json
{ "id": "...", "isActive": false }
```

---

## Rule Execution

### `POST /rules/execute`
Manually execute rules against a scope object (for testing).

**Request body**
```json
{
  "entityType": "Lead",
  "triggerType": "RECORD_SAVE",
  "scope": {
    "id": "lead-123",
    "status": "New",
    "amount": 5000,
    "owner": { "email": "sales@example.com" }
  }
}
```

**Response `200`**
```json
{
  "executedRules": [
    {
      "ruleId": "64f1a2b3c4d5e6f7a8b9c0d1",
      "ruleName": "Set Lead Status on High Value",
      "outcome": "completed",
      "nodesExecuted": ["node-1", "node-2", "node-3"],
      "scopeAfter": { "id": "lead-123", "status": "Hot", "amount": 5000, "owner": { "email": "sales@example.com" } }
    }
  ]
}
```

---

## Execution Logs

### `GET /rule-execution-logs`
List execution logs.

**Query params**
| Param | Type | Description |
|-------|------|-------------|
| `ruleId` | string | Filter by rule |
| `entityId` | string | Filter by entity |
| `outcome` | `completed` \| `failed` \| `skipped` | Filter by outcome |
| `limit` | number | Max results (default 50) |

**Response `200`**
```json
[
  {
    "id": "log-abc",
    "ruleId": "64f1a2b3...",
    "entityType": "Lead",
    "entityId": "lead-123",
    "triggerType": "SQS",
    "outcome": "completed",
    "nodesExecuted": ["node-1", "node-2", "node-3"],
    "errorMessage": null,
    "executedAt": "2026-04-25T12:34:56Z"
  }
]
```

---

## Entity Fields (Schema Discovery)

### `GET /entity-fields/{entityType}`
Returns the available field list for an entity type, used to populate dropdowns in the rule builder UI.

**Response `200`**
```json
[
  { "label": "Status", "value": "status", "type": "string" },
  { "label": "Amount", "value": "amount", "type": "number" },
  { "label": "Owner Email", "value": "owner.email", "type": "string" }
]
```

---

## Notification Templates

### `GET /notification-templates`
List available notification templates for use in Notification nodes.

**Response `200`**
```json
[
  { "id": "deal-won-template", "name": "Deal Won", "channel": "EMAIL" },
  { "id": "lead-assigned-sms", "name": "Lead Assigned", "channel": "SMS" }
]
```
