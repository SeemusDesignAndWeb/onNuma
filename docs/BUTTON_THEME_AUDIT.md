# Button & control colour audit (theme vs non-theme)

Theme provides 5 button colours in Hub Settings → Theme:
- **theme-button-1** – primary (blue) – main CTAs, Send, primary actions
- **theme-button-2** – success (green) – Create, Save, confirm actions
- **theme-button-3** – secondary blue – active nav item, secondary actions
- **theme-button-4** – green variant
- **theme-button-5** – amber – warnings, data-store actions

**Convention:**
- Primary CTA (e.g. Send, Invite): `bg-theme-button-1`
- Create/Save/Submit (success): `bg-theme-button-2`
- Secondary/Filter/Cancel (neutral): `bg-theme-button-3` or `bg-gray-600` (neutral)
- Destructive (Delete): keep `bg-red-500` / `bg-red-600` (semantic danger)
- Nav active (on navbar): `bg-theme-button-3`; text/outline: `text-theme-button-1`, `hover:bg-theme-button-1/10` or `hover:bg-gray-100`

**Replaced in codebase:**
- `hub-blue` / `hub-green` on buttons and nav → theme-button-1, theme-button-2, theme-button-3
- `bg-blue-*`, `bg-green-*`, `bg-purple-*`, `bg-amber-*` on buttons → theme equivalents
- Gray submit (Filter/Search) → `bg-theme-button-3` for consistency where it’s a CTA

**Done:**
- CrmShell nav: active `bg-theme-button-3`, hover/text `text-theme-button-1`, dropdowns `bg-gray-100 text-theme-button-1`
- Hub settings: tabs, focus rings, data-store buttons (amber→theme-5, green→theme-2, gray→theme-3)
- Hub routes: primary buttons → theme-button-1, create/success → theme-button-2, secondary/filter → theme-button-3, preview/secondary link → theme-button-4; focus rings → theme-button-1/2
- hub/images: blue buttons → theme-button-1; hub/audit-logs: gray → theme-button-3

**Remaining (optional):**
- Decorative/panel colours (border-hub-blue-200, from-hub-green-500, text-hub-blue-100, etc.) – not buttons; can stay or switch to theme-panel-head/theme-button for consistency
- Signup/public pages (signup/schedules, signup/schedule, signup/event, event/[token]) – bg-blue-600 primary → could use theme-button-1
- Admin area (admin/*) – bg-blue-500 etc. – could use theme-button-1 if admin should match site theme

**Intentionally left non-theme:**
- Red for destructive (Delete) – semantic
- Gray for true neutral (cancel, secondary text)
- Informational panels (bg-blue-50, bg-amber-50, etc.) – not buttons
