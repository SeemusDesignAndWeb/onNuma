This spec governs Hub-side scheduling: the terminology used throughout
the coordinator interface, the event-to-schedule-to-roles/teams workflow,
assignment rules, the "invite by past role" feature, and the unified
Planner that replaces the separate Service Planner and Meeting Planner.

=======================================================================
TERMINOLOGY
=======================================================================

All user-facing labels are configurable via the terminology store
(Settings > Terminology). The defaults below replace the previous
"Rota" terminology.

Schedule (replaces "Rota")
  One role at one event, with capacity and per-occurrence assignees.
  Coordinators can rename this to "Rota", "Shift", "Service", etc.
  Internal database collection remains "rotas" for backward
  compatibility; the UI always reads from the terminology store.

Role
  The position name (e.g. "Welcome Lead", "Session Lead", "Speaker").
  Roles appear in two places:
  - In schedules: each schedule record represents one role at one event.
  - In teams: each team contains a list of roles; team roles can be
    linked to schedules.

Team
  A named group of roles. Each team role can link to one schedule for
  an event. When viewing a schedule in the Planner, teams whose roles
  are linked to that event's schedules appear grouped under their
  team name.

Event
  Unchanged. Something that happens on specific dates (occurrences).
  Events are the starting point for creating schedules.

Planner (replaces "Meeting Planner" / "Service Planner")
  The unified view that brings schedules, roles, and teams together
  for a selected event. See UNIFIED PLANNER section below.

Session
  A saved sheet for one event occurrence (or "all occurrences") that
  includes role assignments plus meeting-specific metadata (notes,
  communion, speaker topic, series). Exportable as PDF.
  Internal collection remains "meeting_planners" for now.

=======================================================================
WORKFLOW: EVENT > SCHEDULE > ROLES / TEAMS
=======================================================================

Step 1 — Select an event
  The coordinator picks an existing event (e.g. "Sunday Service",
  "Youth Group"). This is the entry point for all scheduling.

Step 2 — Create a schedule
  The coordinator creates a schedule for that event. Creating a
  schedule means adding roles to it.

Step 3 — Populate the schedule
  When building the schedule, the coordinator can:

  a) Create new roles
     Add a fresh role with a name and capacity. This creates a new
     schedule record (event + role name + capacity + empty assignees).

  b) Select existing roles
     Reuse a role definition that already exists in the system (e.g.
     a role name used on another event). This creates a new schedule
     record for this event using that role's name and default capacity.
     It does NOT copy assignees — see ASSIGNMENT RULES.

  c) Select existing teams
     Pick a team. For each role in that team, create or link the
     corresponding schedule record for this event. The team's roles
     are linked to those schedule records via rotaId. The team then
     appears in the Planner under its name.

=======================================================================
ASSIGNMENT RULES
=======================================================================

Rule 1 — Assignees are per schedule, per event
  Each schedule has its own assignees array. Volunteer names are
  never shared, copied, or inherited between schedules or events.

Rule 2 — Selecting a role copies metadata only
  When a coordinator selects an existing role or team, only role
  metadata is reused (name, capacity, team link). Assignees from
  other schedules or events are never carried over.

Rule 3 — Assignees are per occurrence
  Within a schedule, each assignee is associated with a specific
  occurrence (date). A schedule can span all occurrences of an event
  (occurrenceId = null) or target a single occurrence.

=======================================================================
INVITATION: "INCLUDE PEOPLE WHO'VE SERVED IN THIS ROLE ELSEWHERE"
=======================================================================

Purpose
  When inviting people to sign up for a role on a schedule, make it
  easy to reach volunteers who have experience in that role — even
  if their experience is from a different event or schedule.

Behaviour
  When the coordinator opens the invite/sign-up flow for a role on
  a schedule, an option is available:

    "Include people who've served in this role elsewhere"

  When enabled, the system:
  1. Finds all other schedules (across all events for this
     organisation) that share the same role name, or the same
     team-role link.
  2. Collects the distinct contact IDs that appear as assignees
     on those schedules.
  3. Pre-fills or suggests those contacts as invitees.

  The coordinator can add or remove contacts from the list before
  sending invitations. The invitation is for THIS schedule only —
  no assignments are created on other schedules.

  This is a convenience feature; it never bypasses assignment rules
  (see ASSIGNMENT RULES above).

=======================================================================
UNIFIED PLANNER
=======================================================================

The Planner replaces two previously separate features:
  - Service Planner (multi-date grid of teams/roles/assignees)
  - Meeting Planner (single-date session sheet with notes and PDF)

Both are now accessed from one sidebar entry ("Planner") and one
URL tree.

--- Entry point ---
  Sidebar link: "Planner" (configurable via terminology store as
  meeting_planner — default "Planner", previously "Meeting Planner").
  Route: /hub/planner (or /hub/service-planner with redirects).

--- Event selection ---
  On load, the coordinator picks an event. This is required before
  either view is shown.

--- Schedule view (multi-date grid) ---
  Shows upcoming occurrences (columns) × teams and roles (rows).
  Cells show assignee names and fill status (count/capacity).
  This is a live, read-only view computed from events, schedules,
  teams, and occurrences. No saved record is required.

  Teams are grouped; unlinked schedules (roles not in any team)
  appear in a separate "Other" section.

  Restricted team leaders see only their own teams' rows.

--- Session view (single-date sheet) ---
  The coordinator picks a specific occurrence (or "All occurrences").
  Shows: roles with assignees for that date, plus editable fields
  (notes, communion, speaker topic, speaker series).

  Saving creates or updates a session record (meeting_planners
  collection). PDF export is available from this view.

  A list of saved sessions for the selected event is accessible
  from a sub-section (e.g. "Saved sessions" or tabs).

--- Navigation between views ---
  Tabs, toggles, or a segmented control at the top:
    [ Schedule | Session ]
  Switching preserves the selected event.

=======================================================================
TERMINOLOGY STORE CHANGES
=======================================================================

Default values to update:

  rota          -> "Schedule"     (was "Rota")
  meeting_planner -> "Planner"   (was "Meeting Planner")

All other terms remain unchanged:
  hub_name, organisation, coordinator, team_leader, volunteer,
  team, role, event, sign_up, session, group, multi_site.

Files affected:
  src/lib/crm/stores/terminology.js   (DEFAULTS object)
  src/lib/crm/server/settings.js      (getDefaultTerminology())

Existing hub settings that have already customised these terms are
preserved — the new defaults only apply to fresh installs or terms
that have not been overridden.

=======================================================================
DATA MODEL — NO BREAKING CHANGES
=======================================================================

No database collection renames are required in this phase.

  Collection "rotas"            -> UI says "Schedules"
  Collection "meeting_planners" -> UI says "Sessions" (within Planner)
  Collection "teams"            -> unchanged
  Collection "events"           -> unchanged
  Collection "occurrences"      -> unchanged

The rota record schema is unchanged:
  { id, organisationId, eventId, occurrenceId, role, capacity,
    assignees: [{ contactId, occurrenceId }], notes, ownerId,
    visibility, helpFiles }

The team record schema is unchanged:
  { id, organisationId, name, description, eventId,
    roles: [{ id, name, capacity, rotaId }],
    teamLeaderIds }

A future phase may rename collections and fields to match the new
terminology (e.g. rotas -> schedules, rotaId -> scheduleId), but
that is out of scope for this spec.

=======================================================================
PERMISSIONS
=======================================================================

Existing permission keys remain unchanged:

  HUB_AREAS.ROTAS            -> controls access to Schedules
  HUB_AREAS.TEAMS            -> controls access to Teams
  HUB_AREAS.MEETING_PLANNERS -> controls access to Planner

Permission labels in the UI should use the terminology store where
possible (e.g. "Manage schedules" instead of "Manage volunteer rotas").

=======================================================================
SIDEBAR AND NAVIGATION
=======================================================================

Current sidebar items:
  - Schedules (was "Rotas")    -> /hub/rotas
  - Teams                      -> /hub/teams
  - Planner (was "Meeting Planner" / "Service Planner")
                               -> /hub/planner (or /hub/service-planner)
  - Events                     -> /hub/events

The separate /hub/meeting-planners route tree is deprecated in favour
of the unified Planner. Existing URLs should redirect to the Planner
to avoid broken bookmarks.

=======================================================================
OUT OF SCOPE
=======================================================================

The following are explicitly deferred to future phases:

- Renaming database collections (rotas -> schedules, etc.)
- Migrating existing data records
- Renaming internal permission keys (HUB_AREAS.ROTAS, etc.)
- Renaming file-system routes (/hub/rotas -> /hub/schedules)
- Changes to the volunteer-facing myhub interface (covered by
  MYHUB_SPEC.md separately)
