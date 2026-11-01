# Crm-claude-access

CRM platform components: a drag-and-drop business rule builder and SLA tracking.

| Folder | Contents |
|--------|----------|
| `frontend/` | Angular 17 app (plain Angular + Angular CDK) — rule builder UI |
| `backend/` | LoopBack 4 API — rules, rule engine, SQS consumer |
| `database/mysql/` | MySQL 8.0+ schema scripts |
| `packages/sla-engine/` | `@crm/sla-engine` — SLA library (Node.js, zero dependencies) |
| `packages/sla-ui/` | `@crm/sla-ui` — Angular SLA components |
| `android-ai-agent/` | On-device Android AI coding agent |
| `docs/` | Documentation |

## Stack

Angular 17 · Node.js · LoopBack 4 · MySQL 8.0+ · AWS SQS · AWS EventBridge

## Getting started

```bash
# Database: apply the schema scripts in order
for f in database/mysql/0*.sql; do mysql -u <user> -p <database> < "$f"; done

# Install and run frontend + backend
npm run install:all
npm start
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Rule builder](docs/RULE-BUILDER.md)
- [REST API](docs/API.md)
- [SLA tracking](docs/SLA.md)
