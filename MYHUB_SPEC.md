You are building "myhub" — the volunteer-facing area of OnNuma Hub (www.onnuma.com), 
a volunteer management platform. Your job is to create a web interface that is 
exceptionally simple, warm, and accessible — primarily designed for older, less 
tech-confident users who may have never used an app before.

=======================================================================
CORE DESIGN PHILOSOPHY
=======================================================================

Every decision must pass this test: "Could a 74-year-old who has never 
used an app open this on their phone and complete the task without asking 
anyone for help?"

- Zero training required
- One primary action per screen — never more than one main button
- Large, readable text as default (minimum 18px body text, 24px+ for actions)
- High contrast — dark text on light backgrounds only
- No app download required — works entirely in a mobile browser
- No jargon — "Your upcoming shifts" not "Your scheduled assignments"
- Magic link authentication — volunteers never need a username or password

=======================================================================
AUTHENTICATION — MAGIC LINK ONLY
=======================================================================

Volunteers must never be asked to create an account, remember a password, 
or go through a registration form to access their hub.

Flow:
1. Coordinator adds volunteer (name + email/phone)
2. Volunteer receives a warm, personal welcome email (see Email Templates)
3. Email contains a single large button: "Go to My Hub"
4. Clicking the button logs them in automatically via a tokenised magic link
5. They land directly on their personal myhub dashboard — no login screen

For returning visits:
- If their session is still active, take them straight to dashboard
- If session expired, show a single screen: "Send me a new link" button 
  with their email pre-filled. One tap — done.
- Never show a username/password form under any circumstances

=======================================================================
SIGN-UP FLOW — FOR NEW VOLUNTEERS SELF-REGISTERING
=======================================================================

When a coordinator shares a public sign-up link for their organisation:

Step 1 — Welcome screen
- Large warm heading: "Welcome to [Organisation Name]"
- Short friendly sentence explaining what they're signing up for
- Single large button: "Sign Me Up"
- No walls of text, no terms and conditions on this screen

Step 2 — Just the essentials (one field per screen, not a long form)
Screen A: "What's your first name?" + "And your last name?"
Screen B: "What's your email address?" (used for reminders and hub access)
Screen C (optional, if coordinator has enabled it): "Can we also send 
  you text reminders?" with a phone number field — make this feel optional 
  and unthreatening
Screen D: "Are there any days or times that don't work for you?" 
  — simple checkbox grid: Mon/Tue/Wed/Thu/Fri/Sat/Sun × Morning/Afternoon/Evening
  — Label it: "Don't worry, you can change this anytime"

Step 3 — Confirmation screen
- Large friendly message: "You're all signed up, [First Name]!"
- Tell them what happens next: "We'll email you when there's a shift 
  that suits you. You can confirm or decline with one tap."
- Optional: show upcoming events they could volunteer for with 
  a simple "I'm interested" button

=======================================================================
MYHUB DASHBOARD
=======================================================================

This is the volunteer's personal home. Keep it to three sections maximum, 
displayed in this order:

--- SECTION 1: NEXT UP ---
Show only their next confirmed shift, large and prominent:
  - Event name (large, bold)
  - Day and date written in plain English: "This Sunday, 23rd March"  
    — never show dates as "23/03/2025" or similar
  - Time: "10:00am – 12:30pm"
  - Location with a tap-to-open-maps link
  - Who else is on shift (first names only, if coordinator has enabled)
  - A single button: "I can't make this one" (see Cancellation Flow)

If no upcoming confirmed shifts:
  Show: "Nothing coming up yet — we'll let you know when you're needed!"

--- SECTION 2: SHIFTS WAITING FOR YOUR REPLY ---
List any shifts where they've been invited but haven't confirmed:
  Each card shows: event name, date in plain English, time
  Two large buttons per card: ✓ "Yes, I'll be there" | "Can't make it"
  Tapping yes shows instant warm confirmation (see Confirmation Moment)

--- SECTION 3: GET INVOLVED ---
Show upcoming open shifts for their organisation they could volunteer for:
  - Simple cards, one per event
  - "Put my hand up for this" button
  - Don't show too many — max 5 at a time, with a "see more" option

Below all sections, small and unobtrusive:
  - "View all my past shifts" (leads to simple history page)
  - "Update my preferences" (leads to preferences page)

=======================================================================
CONFIRMATION MOMENT
=======================================================================

When a volunteer confirms a shift, the screen must feel warm and satisfying:

- Full screen warm colour (use brand colour, not a generic green flash)
- Large icon (a simple checkmark or similar — not an emoji)
- Text: "You're all set, [First Name]!"
- Sub-text: "See you on [Day], [Date] at [Time]. 
  We'll send you a reminder closer to the day."
- After 2 seconds, return to dashboard automatically — 
  don't make them tap anything else

=======================================================================
CANCELLATION FLOW
=======================================================================

Cancelling must be easy and guilt-free. Volunteers who feel trapped 
disengage entirely. Make this a dignified experience.

When they tap "I can't make this one":

Screen 1:
  Heading: "No problem at all"
  Sub-text: "Would you like to add a note for [Coordinator Name]? 
    (completely optional)"
  Large text input — placeholder: "e.g. I have a prior commitment"
  Two buttons: "Send note and cancel" | "Just cancel, no message"

Screen 2 (confirmation):
  "[Coordinator Name] has been notified. Thanks for letting us know 
  — it really helps with planning."
  Return to dashboard

Coordinator receives immediate notification of the cancellation.

=======================================================================
VOLUNTEER HISTORY & RECOGNITION
=======================================================================

Accessible from dashboard via "View all my past shifts":

- Header: "Your contribution to [Organisation Name]"
- Prominent stat: "You've volunteered X times" — large and celebratory
- If coordinator has sent any personal thank-you messages, 
  show them here in a warm card format
- Simple list of past shifts: event name, date — no clutter
- Option to print this page (for volunteers who like a physical record) — 
  print view must be large text, clean, no navigation elements

=======================================================================
PREFERENCES PAGE
=======================================================================

Keep this simple — it's about making volunteers feel heard, not 
collecting data.

Sections:
1. "Days and times that don't work for me" — same checkbox grid as sign-up
2. "How I'd like to be reminded"
   - Email reminders: On/Off toggle
   - Text reminders: On/Off toggle (if phone number provided)
   - "How far in advance?" — simple options: 1 day before / 2 days before / 
     1 week before / both 1 week and 1 day before
3. "About me" — optional free text: 
   "Anything you'd like your coordinator to know?" 
   (skills, limitations, preferences — framed positively)

Save button at the bottom. Confirmation: "Your preferences have been saved 
— [Coordinator Name] can see these."

=======================================================================
EMAIL TEMPLATES
=======================================================================

All emails from myhub must feel warm and personal, never automated.

--- WELCOME EMAIL (first contact) ---
Subject: "Welcome to [Organisation Name]'s volunteer team, [First Name]!"

Body:
Hi [First Name],

[Coordinator First Name] from [Organisation Name] has added you to their 
volunteer team on OnNuma Hub.

Your personal hub is ready — it's where you'll see your upcoming shifts 
and can let us know if you're available.

[LARGE BUTTON: "Visit My Hub"]

That's it! No passwords to remember. Just tap the button above any time 
you want to check in.

See you soon,
[Coordinator Name]
[Organisation Name]

---

--- SHIFT INVITATION EMAIL ---
Subject: "Can you help on [Day], [Date]? — [Organisation Name]"

Body:
Hi [First Name],

[Coordinator First Name] is looking for volunteers for:

[EVENT NAME]
[Day], [Date] — [Time]
[Location]

Can you make it?

[LARGE BUTTON: ✓ Yes, I'll be there]
[Smaller link: "Sorry, I can't make this one"]

If you have any questions, just reply to this email.

Thank you,
[Coordinator Name]
[Organisation Name]

---

--- REMINDER EMAIL (sent automatically before shift) ---
Subject: "See you [Day]! — [Organisation Name]"

Body:
Hi [First Name],

Just a friendly reminder that you're volunteering with 
[Organisation Name] this [Day]:

[EVENT NAME]
[Day], [Date] — [Time]
[Location link]

[BUTTON: "View in My Hub"]

If something has come up and you can't make it, please let us know 
as soon as you can so we can find cover:
[link: "I can't make this one"]

Thank you — see you [Day]!
[Coordinator Name]

=======================================================================
ACCESSIBILITY REQUIREMENTS
=======================================================================

- Minimum 18px body text, 24px+ for headings and action buttons
- All buttons minimum 48px tall, full width on mobile
- Text size toggle visible on every page — labelled "Make text bigger" 
  not an icon that requires interpretation
- Colour contrast ratio minimum 7:1 (WCAG AAA)
- All interactive elements reachable and usable by keyboard
- Screen reader compatible — all images have alt text, 
  all buttons have descriptive labels
- Plain English throughout — reading age target: 10–12 years old
- Print stylesheet on all key pages — large text, clean layout, 
  no navigation, no buttons
- Never rely on colour alone to convey information

=======================================================================
TECHNICAL REQUIREMENTS
=======================================================================

- Must work in mobile browser without any app install
- Must work on older smartphones (iPhone 6 and equivalent Android)
- Must work on slow connections — no heavy assets on core volunteer pages
- Magic links must be valid for 7 days
- Sessions persist for 30 days without re-authentication
- All volunteer-facing pages must load in under 2 seconds on 3G
- SMS fallback: reminders sent via text if coordinator has enabled it, 
  containing a plain-language message and the magic link
- Coordinator is notified immediately (email + dashboard) on: 
  volunteer confirms shift / volunteer cancels shift / 
  volunteer signs up via public link

=======================================================================
TONE OF VOICE — MYHUB COPY RULES
=======================================================================

Always:
- Use first names wherever possible
- Write dates in plain English ("This Sunday, 23rd March")
- Sound like a friendly human wrote it
- Express genuine appreciation ("it really helps with planning")
- Be brief — if it can be said in 10 words, don't use 20

Never:
- Use tech terms (login, authenticate, session, portal, platform)
- Use formal or corporate language
- Show error codes or technical error messages 
  (replace all with plain English: "Something went wrong — 
  please tap here to try again, or reply to your last email")
- Show dates as numbers only
- Ask for information you don't need

=======================================================================
BRAND FEEL
=======================================================================

myhub should feel like:
- A friendly notice board, not a database
- A message from a person, not a system
- Calm, uncluttered, trustworthy
- Something that respects the volunteer's time and dignity

It should NOT feel like:
- Enterprise software
- A generic SaaS dashboard
- Something designed for a 25-year-old tech user
- Complicated or clever

The volunteer should finish every interaction feeling: 
valued, informed, and unbothered.