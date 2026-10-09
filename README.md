# TDPCS-Apt Web Application

**TDPCS-Apt** is an automated pre-token counter slot booking system built for **Thrissur District Police Co-operative Society (TDPCS)**. It enables cooperative society members to reserve counter visit slots via verified WhatsApp links, and equips branch staff with a realtime queue terminal, live monitoring dashboard, and operational administrative tools.

---

## 1. System Architecture

The application is decoupled into two primary components:

1. **Customer Booking Portal (`/b/[token]`)**
   - **No login required**: Access is granted exclusively through cryptographically secure, time-limited UUID links created by n8n.
   - **Security model**: The `anon` role is strictly restricted via Postgres permissions. It cannot read or modify any tables directly. Only 5 whitelisted RPC functions (`customer_init`, `customer_slots`, `customer_book`, `customer_cancel`, `customer_reschedule`) can be executed.
   - **Verified WhatsApp Identity**: Mobile numbers are resolved internally inside Postgres from `booking_links`. The browser client **never** supplies the phone number.
   - **Mobile-first WhatsApp in-app browser design**: Optimized for 360px screen width, large touch targets (≥48px), sticky action bar, calm banking theme, zero external popups.

2. **Staff & Admin Management Portal (`/app/*`)**
   - **Authentication**: Supabase Auth (email + password) with secure cookies handled by `@supabase/ssr`.
   - **Role-Based Access Control**: `staff` and `admin` roles stored in `profiles`. Role enforcement is handled by Postgres RLS (`is_staff()`, `is_admin()`) and Next.js middleware guards.
   - **Live Monitor (`/app/dashboard`)**: Dual-counter columns, utilisation metrics, Realtime Supabase websocket subscription with 15s fallback polling.
   - **Queue Desk (`/app/queue`)**: Counter operator workstation with quick action buttons (`Arrived`, `Call`, `Served`, `Extend`, `Cancel`, `No-show`, `Call Next`, `Block Date`).
   - **Bookings Master (`/app/bookings`)**: Filterable appointments table with audit drawer and CSV export.
   - **Admin Management**: Calendar & session hours, loan services master, system timing parameters, staff accounts (Edge Function powered), and analytics reports.

3. **External n8n WhatsApp Integration**
   - All WhatsApp messaging is processed externally by n8n.
   - When database booking events occur (`booked`, `rescheduled`, `cancelled`, `no_show`, `time_changed`), a Postgres trigger fires an asynchronous HTTP request using `pg_net` (`net.http_post`) to `n8n_webhook_url`.

---

## 2. Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide React icons, Recharts
- **Backend**: Supabase (PostgreSQL 15+, Auth, Row Level Security, RPC Functions, Realtime, Supabase Edge Functions)
- **Time Zone**: India Standard Time (**Asia/Kolkata**). Timestamps are stored as IST wall-clock strings without timezone drift (`timestamp`), formatted as `10:20 AM` and `10-10-2026 (Saturday)`.
- **Internationalization (i18n)**: English UI by default, organized through a structured dictionary (`lib/i18n.ts`) for straightforward addition of Malayalam (`ml`).

---

## 3. Database Setup & Migration Order

### Step 1: Apply Migration
Open the **Supabase SQL Editor** in your Supabase Dashboard and run:
- `supabase/migrations/0001_tdpcs_apt.sql`

This migration creates:
- PostgreSQL extensions (`btree_gist`, `pg_net`, `pg_cron`)
- Core tables (`profiles`, `products`, `open_days`, `settings`, `token_counters`, `booking_links`, `bookings`, `audit_log`)
- Exclusion constraint preventing double booking on Counter 1 and Counter 2:
  ```sql
  constraint no_overlap exclude using gist (
    counter with =, tsrange(slot_start, slot_end) with &&
  ) where (status in ('booked','arrived','called')) deferrable initially immediate
  ```
- Stored procedures: `get_available_slots`, `book_slot_internal`, `cancel_internal`, `reschedule_internal`, `customer_init`, `customer_slots`, `customer_book`, `customer_cancel`, `customer_reschedule`, `set_booking_status`, `extend_booking`, `block_day`, `no_show_sweep`
- Notification trigger: `trg_notify_n8n`
- RLS policies and `supabase_realtime` publication

### Step 2: Seed Initial Data
If you did not execute the seed portion of migration 0001, execute `supabase/seed.sql` in the SQL editor:
- Seeds loan products: Simple Loan (20 min), Emergency Loan (5 min), Education Loan (5 min), Professional Edu. Loan (15 min), Vehicle Loan (20 min), Hire Purchase Loan (15 min), Chitty Prized Withdrawal (10 min).
- Seeds settings (`slot_step=5`, `report_buffer=10`, `max_extension=30`, `advance_days=15`).
- Seeds open days (Tuesday & Thursday 10:00-13:00, 14:00-15:00; Saturday 10:00-12:30).

### Step 3: Create the First Administrator
1. In the Supabase Dashboard, navigate to **Authentication > Users** and click **Add User**.
2. Create an admin user with email and password (e.g. `admin@tdpcs.coop`).
3. Copy the generated `User UID` (`<AUTH_USER_UUID>`).
4. In the Supabase SQL editor, grant the admin profile:
   ```sql
   insert into profiles (id, full_name, role, active)
   values ('<AUTH_USER_UUID>', 'System Administrator', 'admin', true);
   ```

---

## 4. How n8n Generates Customer Booking Links

When a customer initiates an interaction on WhatsApp, n8n connects to Supabase using the **Service Role Key** (never exposed to the browser) and inserts a record into `booking_links`:

```sql
insert into booking_links (mobile, purpose, expires_at)
values ('919876543210', 'book', now() + interval '30 minutes')
returning id;
```
For a management link (viewing existing reservations):
```sql
insert into booking_links (mobile, purpose, expires_at)
values ('919876543210', 'manage', now() + interval '24 hours')
returning id;
```

n8n formats the link and sends it via WhatsApp:
```
https://<APP_DOMAIN>/b/<id>
```
*(Example: `https://book.tdpcs.coop/b/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`)*

---

## 5. Notification Contract (Webhook to n8n)

Whenever a booking is created, modified, or updated, the `notify_n8n()` trigger posts an HTTP JSON payload to `settings.n8n_webhook_url`:

```json
{
  "event": "booked",
  "booking": {
    "id": 12,
    "token_no": "T-004",
    "customer_name": "Rahul K",
    "mobile": "919876543210",
    "day": "2026-10-10",
    "counter": 2,
    "slot_start": "2026-10-10T10:20:00",
    "slot_end": "2026-10-10T11:00:00",
    "report_time": "2026-10-10T10:10:00",
    "product_ids": [1, 5],
    "status": "booked",
    "cancel_reason": null
  },
  "previous": null,
  "client_number": "914712345678"
}
```

### Event Types
| Event | Trigger Condition | `previous` Field Content |
|---|---|---|
| `booked` | Initial token reservation created | `null` |
| `rescheduled` | Customer changed slot date/time | Complete record of the previous booking |
| `cancelled` | Customer or staff cancelled booking | `null` |
| `no_show` | Customer did not report before slot start | `null` |
| `time_changed` | Staff extended slot duration, shifting times | `{ "slot_start": "...", "slot_end": "...", "counter": 1 }` |

*Note: For rescheduled bookings, only a single `rescheduled` event is dispatched. A redundant `cancelled` event is suppressed by the database trigger.*

---

## 6. Deployment on Vercel

1. Push this repository to GitHub or GitLab.
2. In the Vercel Dashboard, import the repository as a Next.js project.
3. Configure the following Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase public `anon` key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase `service_role` secret (used exclusively in server-side API routes and Edge Functions; never bundled to the client)
   - `NEXT_PUBLIC_APP_URL`: Your production domain (e.g. `https://book.tdpcs.coop`)
4. Deploy the project.

---

## 7. Edge Functions Deployment

Deploy the provided Edge Functions to your Supabase project:
```bash
supabase functions deploy admin-users
supabase functions deploy test-webhook
```

Ensure the Edge Functions have access to `SUPABASE_SERVICE_ROLE_KEY` in the Supabase Dashboard under **Project Settings > Edge Functions**.

---

## 8. Rate Limiting Guidance

To protect public `customer_*` endpoints from brute-force attempts:
1. **Supabase Built-in Rate Limits**: Supabase API Gateway automatically enforces rate limits on standard anon requests (typically 100 requests per 10-second window per IP).
2. **Vercel WAF / Firewall**: On Vercel, enable Firewall rules to limit burst traffic to `/b/*` routes to 30 requests/minute per IP address.
3. **Database-level UUID Validation**: Link tokens are standard 128-bit UUIDv4 identifiers. Guessing valid unexpired tokens is cryptographically infeasible.

---

## 9. Verification & Acceptance Tests

A complete automated acceptance test suite covering all 12 business rules is provided:

### Running SQL Acceptance Tests:
Open `tests/acceptance.sql` in the Supabase SQL editor and execute it. It will verify:
1. Two bookings for the same time land on Counter 1 and Counter 2; a 3rd request is rejected as `slot_taken`.
2. Multi-service durations (Simple Loan 20m + Vehicle Loan 20m = 40m) are respected and never offered past session end.
3. Slot release immediately on cancellation.
4. Reschedule creates a new token and rolls back cleanly if the requested slot is taken.
5. Limit of one active booking per mobile number per day (`already_booked`).
6. Rejection of expired links across all RPCs.
7. Postgres RLS restriction preventing `anon` from accessing tables.
8. Automated time shifting upon booking extension and enforcement of 30-minute max extension.
9. Mass cancellation on date blocking with `cancel_reason = 'day_blocked'`.
10. `no_show_sweep()` selectively marking unarrived bookings.
11. Suppression of redundant cancellation events on reschedule.
12. 360px mobile view responsiveness for WhatsApp in-app browser.

---

## 10. Architectural Decisions & Assumptions Made

1. **Exclusion Constraint for Concurrency Safety**: The Postgres exclusion constraint `tsrange(slot_start, slot_end) with &&` guarantees mathematical impossibility of overlapping slots on the same counter, even under hundreds of parallel concurrent requests.
2. **IST Wall-Clock Timestamps**: Times are stored as wall-clock timestamps in India Standard Time without timezone offsets. This eliminates daylight saving bugs and time zone drift when parsing times in the browser.
3. **Product Deletion Protection**: Deleting a loan scheme that already has booking history automatically deactivates it instead, preserving historical booking and audit data integrity.
4. **Token Resets**: Token numbers (`T-001`, `T-002`, ...) restart from 1 each day using the `token_counters` table with atomic upserts.
