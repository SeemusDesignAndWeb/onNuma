# DBS Bolt-On — Data Model

DBS, Safeguarding, and Pastoral features are gated by `organisation.dbsBoltOn === true` (with backward compatibility for `organisation.churchBoltOn`). Bolt-ons are managed in the multi-org site; they will eventually be assignable via the purchase form.

---

## Organisation (existing collection)

- **dbsBoltOn** (boolean, optional): When true, DBS Bolt-On features (DBS compliance, safeguarding training, pastoral care) are active. Managed in multi-org. Default `false` for existing orgs.
- **churchBoltOn** (boolean, optional, legacy): Treated as equivalent to `dbsBoltOn` when reading; write only `dbsBoltOn` for new/updated orgs.
- **dbsRenewalYears** (number, optional): Years after issue date for DBS renewal due (default 3; some bodies use 2).

---

## Contact (existing collection) — Church-only optional fields

- **dbs** (object, optional): `{ level, dateIssued, renewalDueDate, updateServiceRegistered, certificateRef, notes }`
  - level: `'basic'|'standard'|'enhanced'|'enhanced_barred'`
  - dateIssued, renewalDueDate: ISO date strings
  - updateServiceRegistered: boolean
  - certificateRef: string (optional)
  - notes: string (e.g. 'awaiting renewal, working supervised')
- **safeguarding** (object, optional): `{ level, dateCompleted, renewalDueDate, notes }`
  - level: `'basic_awareness'|'foundation'|'leadership'|'safer_recruitment'|'pso_induction'`
  - dateCompleted, renewalDueDate: ISO date strings
  - notes: string
- **coordinatorNotes** (string, optional): Private notes visible only to Team Leaders (with access) and Administrator. Never shown in myhub.

---

## Team roles (existing collection `teams`)

- **roles[].dbsRequired** (boolean, optional): When true, adding a volunteer without current DBS to this role triggers an administrator warning (not a block).

---

## New collections

### volunteer_absence_events

One row per cancellation or marked-absent occurrence (for pastoral absence pattern).

- **id**: string (ulid)
- **organisationId**: string
- **contactId**: string
- **rotaId**: string (optional)
- **occurrenceId**: string (optional)
- **type**: `'cancelled'` | `'marked_absent'` — volunteer cancelled vs coordinator marked absent
- **createdAt**: ISO string
- **createdBy**: adminId (optional; for marked_absent)

### volunteer_pastoral_flags

Flags shown on volunteer profile (e.g. absence pattern, long-service prompt). Dismissible / follow-up.

- **id**: string (ulid)
- **organisationId**: string
- **contactId**: string
- **type**: `'absence'` | `'long_service'`
- **status**: `'active'` | `'dismissed'` | `'followed_up'`
- **message**: string (e.g. "Margaret has missed 3 sessions recently — you may wish to check in")
- **pastoralNote**: string (private, only Hub)
- **followedUpAt**: ISO string (optional)
- **dismissedAt**: ISO string (optional)
- **createdAt**: ISO string
- **updatedAt**: ISO string

### volunteer_milestones (optional — can be computed)

If we want to avoid re-notifying, store when coordinator was prompted or thanked.

- **id**: string (ulid)
- **organisationId**: string
- **contactId**: string
- **milestoneKey**: string (e.g. `'1_year'`, `'50_sessions'`)
- **reachedAt**: ISO string
- **notifiedAt**: ISO string (optional) — when coordinator was shown prompt / sent thank-you

---

## Existing collections used (no schema change)

- **volunteer_thankyou**: Already used for coordinator thank-you messages (long-service recognition).
- **myhub_invitations**: status `declined` + respondedAt used as one source for "cancelled" when recording volunteer_absence_events (plus explicit cannotVolunteer / mark-absent).

---

## Terminology

All user-facing labels use the terminology store (e.g. `$terminology.volunteer`, `$terminology.team_leader`, `$terminology.coordinator`). No hard-coded "church" terminology in feature UI.
