# Volunteer Management Platform — UX Redesign Specification

This document defines the **layout, behaviour, information architecture, and user experience** for the multi-organisation admin (“Hub” and org admin) and volunteer-facing areas. It is technology-agnostic and focuses on clarity, accessibility, and ease of use for non-technical users, including older volunteers.

---

## 1. Global Design Principles

Apply across admin and volunteer experiences:

| Principle | Description |
|-----------|-------------|
| **Calm, welcoming aesthetic** | Community-focused, not corporate. Soft neutrals, friendly tone. |
| **Large readable typography** | Base size comfortable for all ages; avoid small body text. |
| **Clear primary actions** | One obvious next step per context; buttons stand out. |
| **Consistent card-based layout** | Content in rounded cards with subtle shadows and clear headers. |
| **Accessible colour contrast** | Meet WCAG AA for text and interactive elements. |
| **Minimal cognitive load** | Fewer choices per screen; progressive disclosure where needed. |
| **Mobile-friendly** | Desktop-first layout that responds well on tablets and phones. |
| **Friendly, human wording** | Plain language; avoid jargon (e.g. “rotas” explained where needed). |
| **Large click targets** | Minimum ~44px touch targets; generous padding on links and buttons. |
| **Fast perceived performance** | Optimistic UI, skeletons, and clear loading states. |

**Visual style:** Clean, modern SaaS dashboard — soft neutral backgrounds, rounded cards, subtle shadows, strong hierarchy, generous whitespace. No clutter.

---

## 2. Sidebar Navigation (Hub Admin & Multi-Org Admin)

**Change:** Replace the current **top horizontal navigation** with a **left vertical sidebar** in both Hub (single-org) and multi-organisation admin contexts.

### 2.1 Requirements

- **Collapsible:** User can toggle between expanded and collapsed.
- **Collapsed state:** Icons only (no labels).
- **Expanded state:** Icons + text labels.
- **Animation:** Smooth expand/collapse (e.g. 200–300ms).
- **Persistence:** Remember user preference (e.g. localStorage or account setting).
- **Active section:** Clearly highlight the current section (e.g. background + optional left border).
- **Sticky:** Sidebar stays fixed while main content scrolls.
- **Tooltips when collapsed:** On hover/focus, show the section name so users don’t lose context.
- **Accessibility:** Large click targets (min ~44px), keyboard navigable, `aria-expanded` and `aria-label` where appropriate.

### 2.2 Structure

**Top area**

- **Organisation switcher** (multi-org admins only): Dropdown or list to switch between organisations. Current org name visible when expanded; icon when collapsed.

**Main navigation (order and labels are suggestions)**

1. **Dashboard** — Overview and widgets.
2. **Rotas** — Rota management.
3. **Events** — Events and calendar.
4. **Contacts** — Contact list and management (single entry; no separate “Lists”/“Members” in top-level nav unless needed — see Contacts section).
5. **Messages** — Email/newsletters (or “Emails”).
6. **Forms** — Forms and submissions.
7. **Reports** — Analytics and exports.
8. **Organisation Settings** — Org-level configuration (or “Settings” in single-org).
9. **Integrations** — External services (if applicable).
10. **Help** — Help and documentation.

**Bottom area**

- **User profile** — Name, avatar, link to profile/settings.
- **Notifications** — In-app notifications (if implemented).
- **Logout** — Clear, always visible.

**Note:** Map existing Hub areas (Contacts, Lists, Members, Events, Meeting Planners, Rotas, Emails, Forms, Video Tutorials, etc.) into this structure; some may live under a single nav item with sub-pages or tabs.

---

## 3. Dashboard Redesign — Modular Panels

Replace the current fixed dashboard (stat cards + “Latest events / emails / rotas” panels) with a **modular dashboard** built from draggable panels (widgets).

### 3.1 Requirements

- **Grid layout:** Responsive grid (e.g. 12 columns); panels span configurable widths.
- **Drag-and-drop:** Users can reorder panels by dragging.
- **Save layout per admin user:** Each user’s arrangement is saved (per org).
- **Resize/hide:** Panels can be resized (if desired) and hidden via panel options.
- **Default layout:** New users see a sensible default set and order of panels.
- **Card styling:** Each panel is a card with a clear header (title + optional actions).
- **Quick actions:** Panels may expose one or more quick actions (e.g. “View rota”, “Send request”).

### 3.2 Panels to Remove Entirely

- **Latest events panel** — Remove.
- **Latest emails panel** — Remove.
- **Latest rotas panel** — Remove.

(These are replaced by the new panel set below and by dedicated sections.)

### 3.3 New / Updated Panels

#### Rota Gaps Panel (High priority)

- **Purpose:** Surface rota shortages so admins can act quickly.
- **Content:**
  - Rota name.
  - Dates with no (or insufficient) volunteers.
  - Number of positions still required.
  - **Priority indicator:** e.g. red when zero coverage; amber when low.
- **Sorting:** By urgency (worst first).
- **Quick actions:**
  - View rota.
  - Send request to volunteers.
  - Invite specific people.
  - Copy sign-up link.

#### Volunteer Engagement Leaderboard

- **Purpose:** Recognition and encouragement (not competition).
- **Content:**
  - Volunteer name + avatar.
  - Participation count (e.g. rotas/events).
  - Events attended (if applicable).
  - Recent activity indicator.
- **Link:** “View full report” to detailed engagement report.

#### Engagement Graph Panel

- **Content:**
  - Engaged vs non-engaged volunteers over time (e.g. last 3 months).
  - Simple chart with clear axis labels and legend.
- **Style:** Avoid complex analytics; keep it readable at a glance.

#### Compact Quick Stats Panel

- **Purpose:** Replace large stat buttons with compact tiles.
- **Possible metrics:** Total volunteers, active volunteers, upcoming events, open rota slots, messages awaiting reply (or similar).
- **Design:** Smaller cards, clear numbers, subtle icons. Each tile clickable for drill-down. Efficient use of space.

#### Suggested People to Invite Panel

- **Purpose:** Re-engage volunteers who are registered but not participating.
- **Content:**
  - Name.
  - Last activity date.
  - Skills or tags (if available).
  - Suggested roles.
  - **Invite** button.
- **Tone:** Encouraging, not punitive.

---

## 4. Communications & Calendar

### 4.1 Email-Based Rota Communication

- **Sender:** Emails sent from rota owner/manager (or org identity); replies go to that person’s inbox.
- **Content:** Clear subject lines; rota details in body; accept/decline links.
- **Tracking:** Track responses (accepted, declined, no response).
- **UX:** Simple flow to “Send rota request by email” from rota context (e.g. from Rota Gaps panel or rota detail).

### 4.2 SMS Messaging (Optional)

- **Use cases:** Urgent rota requests, last-minute changes, event reminders.
- **Requirements:**
  - Volunteer **opt-in** only.
  - **Consent management** (record and show consent; allow revoke).
  - **Message history** visible to admins (and optionally to volunteer).
  - **Organisation cost awareness** (e.g. usage or cost summary in settings).
  - **Simple compose UI** for admins (e.g. template + send to selected volunteers).

### 4.3 Calendar Integration

- **Behaviour:** Automatically include calendar invites for rotas and events.
- **Formats:** iCal attachment in emails; “Add to calendar” link (Google, Apple, Outlook compatible).
- **Updates:** When rota/event details change, communicate update (e.g. updated invite or follow-up email).
- **Clarity:** Time and location clearly stated in invite and in UI.

---

## 5. Contacts Section (Admin)

Contacts is a **full section** (not just a card on the dashboard).

**Capabilities:**

- View list of contacts with search and filter.
- Edit profile details and update email address.
- View **activity history** and **participation overview**.
- Manage **tags / skills**.
- Manage **communication preferences** (email/SMS, etc.).

**Goal:** Support maintaining accurate, up-to-date records with minimal effort. Clear actions (e.g. “Edit”, “View activity”) and avoid hidden or nested workflows.

---

## 6. Hide Members Feature → Forms

**Change:** Move “Hide Members” (visibility/privacy) into the **Forms** system.

- Organisations define their own **visibility/privacy form** (e.g. “Who can see the member list?”).
- **Form responses** drive member visibility (e.g. “Only leaders” vs “Everyone”).
- **Customisable fields** so each org can match their policy.
- **Admin review option** (e.g. approve or override visibility).
- Supports organisation-specific policies without hard-coding rules.

---

## 7. Member Self-Service Portal (Volunteer Experience)

**Purpose:** Replace the simple rota signup page with a **full self-service area** where volunteers can manage their participation and details without admin help.

**Suggested label (friendly, non-technical):**  
“My volunteering” | “My schedule” | “My rota & availability” | “My involvement” — choose one and use consistently.

**Audience:** Non-technical users, including older volunteers. Design for low technical confidence.

### 7.1 Portal Structure (Information Architecture)

1. **Profile & contact details**
2. **Availability & away status**
3. **My rotas & commitments**
4. **Sign up for available opportunities**
5. **Notifications & reminders**
6. **Communication preferences**
7. **Activity summary**

### 7.2 Profile & Contact Details

- **View** name and details.
- **Update** email (with verification step).
- **Update** phone number.
- **Optional** profile photo.
- **Optional** emergency contact.
- **Communication preferences** (email/SMS opt-in) — can also live in section 7.6.
- **Confirmation messages** after any update (e.g. “Your details have been saved”).

### 7.3 Availability & Away Status

- **Set date ranges** when unavailable (“Do not schedule me during this period”).
- **Visible effect:** Rotas and “Sign up” respect away status (no assignments in that period, or clear warning).
- **Edit or remove** away entries.
- **Optional:** Recurring unavailability (e.g. every Tuesday).
- **Input:** Simple calendar/date selector; avoid complex controls.

### 7.4 My Rotas & Commitments

- **Show:** Upcoming assignments with role, location, date and time.
- **Status:** Confirmed / pending / needs cover (or similar).
- **Actions:** Accept or decline; request swap or cover; link to full details.
- **Optional:** Show past participation for context.

### 7.5 Sign Up for Available Opportunities

- **List** available rota roles and events with clear descriptions.
- **One-click sign-up** where possible; confirmation feedback.
- **Prevent double booking** (e.g. same slot or overlapping times).
- **Respect away status** — don’t offer slots in away periods (or show warning).

### 7.6 Notifications & Reminders

- **Show:** Upcoming reminders, confirmations, changes, important announcements.
- **Presentation:** Calm and uncluttered; prioritise what’s actionable.

### 7.7 Communication Preferences

- **Controls:** Email on/off; SMS on/off (if enabled).
- **Options:** Immediate vs digest (e.g. daily summary) where applicable.
- **Copy:** Clear explanations of what each option means.

### 7.8 Activity Summary

- **Content:** Recent participation count, upcoming commitments, areas of involvement.
- **Tone:** Encouraging; avoid performance scoring or pressure.

### 7.9 Usability Requirements for Member Portal

- **Large buttons** and touch targets.
- **Clear language**; minimal steps for common tasks (e.g. “Update email” in few steps).
- **Strong visual hierarchy** (one primary action per screen where possible).
- **Mobile-friendly layout** (same IA, responsive).
- **Accessible interactions** (keyboard, focus, screen reader friendly).
- **No hidden critical features** — main actions (profile, availability, my rotas, sign up, preferences) are always discoverable (e.g. from a simple nav or dashboard).

---

## 8. Multi-Org Admin Alignment

- **Same sidebar pattern** as Hub: collapsible left sidebar, same behaviour (remember state, tooltips when collapsed, sticky).
- **Organisation switcher** at top of sidebar when user has access to multiple organisations.
- **Navigation items** may vary by role (e.g. super-admin sees Organisations, Plans, Billing; org admin sees Hub-style items for selected org).
- **Visual language** (cards, typography, colours) consistent with Hub so switching between “multi-org” and “Hub” feels like one product.

---

## 9. Summary of Key UX Changes

| Area | Current (conceptual) | Redesign |
|------|---------------------|----------|
| **Navigation** | Top bar, dropdowns | Left sidebar, collapsible, icons + labels, org switcher (multi-org) |
| **Dashboard** | Fixed stat cards + latest events/emails/rotas | Modular, draggable panels; remove latest-* panels; add Rota Gaps, Engagement Leaderboard, Engagement Graph, Quick Stats, Suggested People |
| **Rota visibility** | — | Rota Gaps panel high priority; email rota requests; calendar invites |
| **Contacts** | In nav / dashboard | Full section: list, search, filter, activity, tags, preferences |
| **Hide Members** | Separate feature | Moved into Forms (visibility/privacy form) |
| **Volunteer experience** | Simple signup page(s) | Full self-service portal: profile, availability, my rotas, sign up, notifications, preferences, activity summary |
| **Communications** | — | Email rota flow; optional SMS (opt-in, consent, history); calendar integration |

---

## 10. Implementation Notes (Guidance Only)

- **Phasing:** Sidebar and dashboard panels can be phased (e.g. sidebar first, then panel set, then member portal).
- **Defaults:** Define a default dashboard layout and default visibility for each panel type so new users see value immediately.
- **Accessibility:** Run critical paths through keyboard-only and a screen reader; test with users who have low vision or motor limitations.
- **Copy:** Use the same friendly terminology in UI, emails, and help (e.g. “My volunteering” vs “Member portal” in user-facing text).

This document is the single source of truth for the volunteer management UX redesign; implementation details (components, APIs, state management) should follow these layout, behaviour, and IA decisions.
