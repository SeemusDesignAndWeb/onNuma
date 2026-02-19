# Implementation Prompt: Schedules and Unified Planner

Implement the OnNuma Hub schedule and planner behaviour described in
`docs/SCHEDULES_AND_PLANNER_SPEC.md`. Preserve existing APIs and data
shapes where possible. Work in three phases: terminology changes first,
then the invite-by-past-role feature, then planner unification.

---

## Phase 1 — Terminology: "Rota" to "Schedule", unified "Planner" label

### 1.1 Update default terminology

In `src/lib/crm/server/settings.js`, function `getDefaultTerminology()`:
- Change `rota: 'Rota'` to `rota: 'Schedule'`
- Change `meeting_planner: 'Meeting Planner'` to `meeting_planner: 'Planner'`

In `src/lib/crm/stores/terminology.js`, the `DEFAULTS` object:
- Change `rota: 'Rota'` to `rota: 'Schedule'`
- Change `meeting_planner: 'Meeting Planner'` to `meeting_planner: 'Planner'`

Existing hubs that have already customised these terms are unaffected
because `getSettings()` merges stored overrides over defaults.

### 1.2 Audit all hard-coded "rota" / "meeting planner" UI strings

Search every `.svelte` file for hard-coded strings like "Rota", "Rotas",
"rota", "meeting planner", "Meeting Planner", "Meeting Planners" that
appear in user-visible text (headings, labels, descriptions, empty
states, placeholders, tooltips).

Replace each with the appropriate terminology store reference:
- `$terminology.rota` (singular) or `$terminology.rota + 's'` (plural)
- `$terminology.meeting_planner`

Key files to check (non-exhaustive):
- `src/lib/crm/components/HubSidebar.svelte`
- `src/lib/crm/permissions.js` (the `label` and `description` fields
  in permission option arrays — these are user-visible)
- `src/routes/hub/rotas/**/*.svelte`
- `src/routes/hub/teams/[id]/+page.svelte`
- `src/routes/hub/service-planner/+page.svelte`
- `src/routes/hub/meeting-planners/**/*.svelte`
- `src/routes/hub/settings/+page.svelte`
- `src/routes/hub/users/+page.svelte`
- `src/lib/crm/onboardingSteps.js`

Do NOT rename:
- Database collection names (`rotas`, `meeting_planners`)
- Internal permission keys (`HUB_AREAS.ROTAS`, etc.)
- Route paths (`/hub/rotas`, `/hub/meeting-planners`)
- Server-side variable names or function names

### 1.3 Settings page terminology tab

In `src/routes/hub/settings/+page.svelte`, the terminology editing UI:
- Update any labels/descriptions that reference "Rota" or "Meeting
  Planner" to use the new defaults as examples.
- The "meeting-planner" settings tab label should read "Planner" by
  default (use `$terminology.meeting_planner` if available in context).

---

## Phase 2 — Invite by past role

### 2.1 Server helper: find contacts who served in a role elsewhere

Create a helper function in `src/lib/crm/server/teams.js` (or a new
file `src/lib/crm/server/scheduleHelpers.js`):

```javascript
/**
 * Find contacts who have been assigned to a given role on other
 * schedules (rotas), excluding a specific schedule.
 *
 * @param {string} roleName - The role name to search for.
 * @param {string} excludeRotaId - The schedule to exclude (the one
 *   the coordinator is currently inviting for).
 * @param {string} organisationId - Scope to this organisation.
 * @returns {Promise<string[]>} Distinct contact IDs.
 */
export async function findContactsByPastRole(roleName, excludeRotaId, organisationId)
```

Logic:
1. Read `rotas` collection, filter by organisation.
2. Filter to rotas where `rota.role === roleName` (case-insensitive
   trim) and `rota.id !== excludeRotaId`.
3. Collect all distinct `contactId` values from those rotas' assignees.
4. Return the array of unique contact IDs.

### 2.2 Expose in the invite / bulk-invite flow

In the schedule detail page (`src/routes/hub/rotas/[id]/+page.svelte`
and its `+page.server.js`), where the coordinator assigns or invites
volunteers:

- Add a toggle or checkbox: "Include people who've served in this
  role elsewhere" (label uses `$terminology.rota` if appropriate).
- When enabled, call the helper (via a form action or API endpoint)
  to get suggested contacts.
- Pre-fill the invite list with those contacts. The coordinator can
  add or remove contacts before sending.
- Invitations are for this schedule only — no side effects on other
  schedules.

### 2.3 Also expose in team schedule view

In `src/routes/hub/teams/[id]/+page.svelte`, the assign modal already
lets coordinators pick contacts. Add the same "Include people who've
served in this role elsewhere" option here, calling the same helper.

---

## Phase 3 — Unified Planner

### 3.1 Merge Service Planner and Meeting Planner into one route

Option A (preferred): keep `/hub/service-planner` as the unified route.
Option B: create `/hub/planner` and redirect `/hub/service-planner`.

Either way, the page should have:

- Event selector (existing behaviour from service planner).
- Two tabs/views:
  - **Schedule** — the current service planner grid (teams x roles x
    upcoming occurrences with assignee names and fill counts).
  - **Session** — the current meeting planner detail view for one
    occurrence (or "all"), with notes, communion, speaker topic,
    speaker series, and PDF export.

URL structure:
  /hub/planner?eventId=…                          (Schedule view)
  /hub/planner?eventId=…&view=session              (Session list)
  /hub/planner?eventId=…&view=session&id=…         (Edit session)
  /hub/planner?eventId=…&view=session&new=1        (New session)

### 3.2 Session list and CRUD

Within the Session tab, show a list of saved session records
(meeting_planners collection) for the selected event. From here the
coordinator can:
- Create a new session (picks occurrence, adds notes, etc.).
- Edit an existing session.
- Export as PDF.
- Delete a session.

Reuse the existing meeting planner server logic from
`src/routes/hub/meeting-planners/[id]/+page.server.js` and the new
and list pages. Refactor as needed to work within the unified route.

### 3.3 Redirect old routes

Add server-side redirects so existing bookmarks keep working:
- `/hub/meeting-planners` -> `/hub/planner?view=session`
- `/hub/meeting-planners/new` -> `/hub/planner?view=session&new=1`
- `/hub/meeting-planners/:id` -> `/hub/planner?view=session&id=:id`
- `/hub/meeting-planners/quick-view` -> `/hub/planner?view=session`
- `/hub/meeting-planners/export-next-4-pdf` -> keep as-is (API route)
- `/hub/meeting-planners/:id/export-pdf` -> keep as-is (API route)

### 3.4 Update sidebar

In `src/lib/crm/components/HubSidebar.svelte`:
- The "Service Planner" link becomes the unified "Planner" link
  (use `$terminology.meeting_planner`), pointing to `/hub/planner`.
- Remove the separate meeting-planners entry if one exists.
- The Events sidebar entry no longer needs to cover meeting-planners
  routes for its active state.

### 3.5 Update permissions

In `src/lib/crm/permissions.js`:
- Route `/hub/planner` (or `/hub/service-planner`) should require
  `HUB_AREAS.MEETING_PLANNERS` or `HUB_AREAS.ROTAS` or
  `HUB_AREAS.TEAMS` or team-leader access (same logic as the current
  service planner).
- Update user-visible permission labels to use terminology where
  possible (e.g. "Manage schedules" instead of "Manage volunteer
  rotas").

---

## Out of scope

Do NOT do any of the following in this implementation:

- Rename database collections (rotas, meeting_planners, etc.)
- Rename internal JS variables, function names, or module file names
  to replace "rota" with "schedule"
- Rename file-system route directories (/hub/rotas -> /hub/schedules)
- Rename internal permission keys (HUB_AREAS.ROTAS, etc.)
- Migrate or transform existing data records
- Change the volunteer-facing myhub interface

These are deferred to a future phase.

---

## Testing checklist

After implementation, verify:

- [ ] Fresh hub install shows "Schedule" and "Planner" as defaults
- [ ] Existing hub with custom terminology (e.g. rota = "Service")
      still shows the custom value, not "Schedule"
- [ ] No hard-coded "Rota" or "Meeting Planner" appears in the UI
- [ ] Invite flow on schedule detail page offers "Include people
      who've served in this role elsewhere" and correctly suggests
      contacts from other schedules
- [ ] Unified Planner shows both Schedule (grid) and Session (sheet)
      tabs for a selected event
- [ ] Session CRUD works within the Planner (create, edit, delete,
      PDF export)
- [ ] Old /hub/meeting-planners/* URLs redirect to Planner
- [ ] Sidebar shows one "Planner" link, not two separate entries
- [ ] Permissions: team leaders see only their teams in the Planner;
      coordinators with "rotas" or "meeting_planners" permission
      can access the full Planner
- [ ] PDF export routes still work (/hub/meeting-planners/[id]/export-pdf
      and /hub/meeting-planners/export-next-4-pdf)
