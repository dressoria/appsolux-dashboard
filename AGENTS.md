# Appsolux Dashboard - Agent Instructions

## Project

This repository contains the Appsolux SaaS dashboard.

Appsolux is a B2B SaaS platform for customer support, automation, messaging channels, and business management.

## Main stack

- Next.js with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Server-side API routes
- Server Components when possible
- Client Components only when interaction or client state is required

## External systems

Appsolux connects with:

- Chatwoot for conversations, contacts, inboxes, and support.
- ERPNext v15 for customers, companies, accounting, invoices, subscriptions, and business data.
- n8n for provisioning, long-running workflows, retries, and automations.
- Evolution API for WhatsApp QR / instance connection.
- Meta API for WhatsApp Cloud API, Instagram, and Messenger.

## Critical multitenant rules

Never hardcode tenant or account identifiers.

Forbidden examples:

- account_id: 1
- chatwoot_account_id: 1
- tenant_id fixed value
- company_id fixed value
- inbox_id fixed value

All tenant-specific identifiers must come from the authenticated user and the resolved tenant.

## Security rules

- Never expose private tokens in frontend code.
- Never call Chatwoot, ERPNext, Evolution, Meta, or n8n directly from client components.
- Use server-side code for private integrations.
- Validate tenant access before reading or writing tenant data.
- Never trust account_id or tenant_id sent from the browser without server-side validation.
- Secrets must stay in .env.local or production environment variables.

## Architecture rules

Use this separation:

- Next.js: dashboard, UI, session, permissions, immediate reads and actions.
- n8n: initial registration, provisioning, retries, and multi-system workflows.
- Chatwoot: conversation engine.
- Evolution API: WhatsApp connection by QR / instance.
- Meta API: official WhatsApp Cloud API, Instagram, and Messenger.
- ERPNext: business, accounting, billing, subscriptions, and customer records.

## Development rules

Before changing code:

1. Inspect the current structure.
2. Explain what files will be changed.
3. Make small changes.
4. Do not refactor large areas without approval.
5. Do not install packages without explaining why.
6. Do not delete files without approval.
7. Prefer strict TypeScript.
8. Avoid any unless necessary and explained.
9. Do not invent external endpoints.
10. Do not invent credentials.

## Folder responsibilities

- app/: routes, layouts, pages, API routes.
- components/appsolux/: Appsolux-specific UI components.
- components/ui/: shadcn/ui components.
- lib/api/: server-side API clients for external services.
- lib/auth/: session and current user logic.
- lib/tenant/: tenant resolution and validation.
- lib/security/: server-only safety helpers.
- types/: shared TypeScript types.
- store/: client state only when needed.
- docs/: project documentation.
- config/: app configuration, navigation, and routes.