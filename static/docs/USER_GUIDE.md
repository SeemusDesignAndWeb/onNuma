# The HUB User Guide

## Table of Contents

1. [Getting Started](#getting-started)
   - [Login](#login)
   - [Forgot Password](#forgot-password)
   - [Dashboard](#dashboard)
2. [Admin Users](#admin-users)
   - [Managing Admin Users](#managing-admin-users)
   - [Creating Admin Users](#creating-admin-users)
   - [Editing Admin Users](#editing-admin-users)
   - [Admin Profile](#admin-profile)
3. [Contacts](#contacts)
   - [Creating a Contact](#creating-a-contact)
   - [Editing a Contact](#editing-a-contact)
   - [Importing Contacts](#importing-contacts)
   - [Managing Contacts](#managing-contacts)
4. [Lists](#lists)
   - [Creating a List](#creating-a-list)
   - [Adding Contacts to Lists](#adding-contacts-to-lists)
   - [Removing Contacts from Lists](#removing-contacts-from-lists)
   - [Managing Lists](#managing-lists)
5. [Newsletters](#newsletters)
   - [Creating a Newsletter](#creating-a-newsletter)
   - [Editing a Newsletter](#editing-a-newsletter)
   - [Previewing a Newsletter](#previewing-a-newsletter)
   - [Sending a Newsletter](#sending-a-newsletter)
   - [Deleting a Newsletter](#deleting-a-newsletter)
   - [Newsletter Templates](#newsletter-templates)
   - [HTML Editor Features](#html-editor-features)
6. [Events](#events)
   - [Creating an Event](#creating-an-event)
   - [Event Calendar Views](#event-calendar-views)
   - [Adding Occurrences](#adding-occurrences)
   - [Editing Occurrences](#editing-occurrences)
   - [Downloading Events](#downloading-events)
7. [Rotas](#rotas)
   - [Creating a Rota](#creating-a-rota)
   - [Managing Rotas](#managing-rotas)
   - [Bulk Invitations](#bulk-invitations)
8. [Forms](#forms)
   - [Creating a Form](#creating-a-form)
   - [Viewing Form Submissions](#viewing-form-submissions)
   - [Public Form Submission](#public-form-submission)
8. [Public Signup](#public-signup)
9. [Help and Documentation](#help-and-documentation)

---

## Getting Started

### Login

1. Navigate to `/hub/auth/login`
2. Enter your email and password
3. You'll be redirected to the dashboard upon successful login

**Note:** If you've forgotten your password, use the "Forgot password?" link on the login page.

### Forgot Password

If you've forgotten your password, you can reset it using the forgot password feature:

1. On the login page (`/hub/auth/login`), click the "Forgot password?" link
2. Enter your email address
3. Click "Send Reset Link"
4. Check your email for a password reset link
5. Click the link in the email (or copy and paste it into your browser)
6. Enter your new password (must meet complexity requirements)
7. Confirm your new password
8. Click "Reset Password"
9. You'll be redirected to the login page with a success message

**Password Requirements:**
- At least 12 characters long
- Must contain at least one uppercase letter
- Must contain at least one lowercase letter
- Must contain at least one number
- Must contain at least one special character

**Security Features:**
- Reset links expire after 24 hours
- All active sessions are logged out after password reset
- The system protects against email enumeration (always shows success message)

**Note:** If you don't receive an email, check your spam folder. The email will come from your configured Resend sender address.

### Dashboard

The dashboard (`/hub`) provides a comprehensive overview of your CRM system:

**Statistics Overview:**
- Total number of contacts
- Total number of lists
- Total number of newsletters
- Total number of events
- Total number of rotas
- Total number of forms

**Quick Actions:**
Use the coloured quick action buttons at the top to quickly create:
- **+ Contact** (Blue) - Create a new contact
- **+ Newsletter** (Green) - Create a new newsletter
- **+ Event** (Purple) - Create a new event
- **+ Rota** (Orange) - Create a new rota
- **+ List** (Teal) - Create a new list
- **+ Form** (Pink) - Create a new form

**Recent Activity:**
- **Latest Newsletters**: Displays the 3 most recently created or edited newsletters
- **Recently Edited Rotas**: Shows the 5 most recently edited rotas

Click on any item in the recent activity sections to view its details.

---

## Admin Users

The Hub includes comprehensive admin user management for controlling access to the system.

### Managing Admin Users

**Viewing Admin Users:**
1. Go to `/hub/users` (accessible from the main navigation)
2. View all admin users in a table format
3. See user status (Active, Locked, Unverified)
4. Search for users by name or email
5. Use pagination to navigate through large lists

**Admin User Status:**
- **Active**: User can log in and use the system
- **Locked**: Account is temporarily locked due to too many failed login attempts
- **Unverified**: Email address has not been verified yet

**Search and Filter:**
- Use the search box to find users by name or email
- Search is case-insensitive and updates as you type
- Results are paginated for easy navigation

### Creating Admin Users

Only existing admins can create new admin users:

1. Go to `/hub/users`
2. Click "New Admin User" button
3. Fill in the form:
   - **Name** (required) - The admin's full name
   - **Email** (required) - Must be a valid, unique email address
   - **Password** (required) - Must meet complexity requirements
4. Click "Create Admin User"

**Password Requirements:**
- At least 12 characters long
- Must contain at least one uppercase letter
- Must contain at least one lowercase letter
- Must contain at least one number
- Must contain at least one special character

**What Happens After Creation:**
- A welcome email is sent to the new admin user
- The email includes:
  - Login credentials (email and password)
  - Email verification link
  - Link to TheHUB login page
- The new admin must verify their email before full access is granted
- The admin can log in immediately, but should verify their email

### Editing Admin Users

You can edit admin user details:

1. Go to `/hub/users`
2. Click on the admin user you want to edit
3. Click "Edit" button
4. Modify:
   - **Name** - Update the admin's name
   - **Email** - Change email address (requires re-verification)
5. Click "Save Changes"

**Email Changes:**
- When an admin's email is changed, their email verification status is reset
- They will need to verify their new email address
- A verification email is sent automatically

**Password Reset:**
- Admins can reset their own password from their profile page
- Other admins can reset a user's password from the user management page
- Password reset requires entering a new password (must meet complexity requirements)

**Account Status Management:**
- **Unlock Account**: If an account is locked, you can unlock it from the user detail page
- **Verify Email**: You can manually verify an admin's email if needed
- **Delete User**: Permanently remove an admin user (use with caution)

### Admin Profile

Each admin can manage their own profile:

**Accessing Your Profile:**
1. Click on your name/email in the top-right corner of the Hub
2. Or navigate to `/hub/profile`

**Profile Features:**
- **View Account Information**: See your name, email, role, and account status
- **Edit Name and Email**: Update your personal information
- **Change Password**: Update your password (requires current password)
- **View Account Status**: See if your email is verified

**Changing Your Password:**
1. Go to your profile page (`/hub/profile`)
2. Scroll to "Change Password" section
3. Enter:
   - **Current Password** - Your current password
   - **New Password** - Must meet complexity requirements
   - **Confirm New Password** - Re-enter the new password
4. Click "Change Password"

**Security Notes:**
- When you change your password, all active sessions are logged out
- You'll need to log in again with your new password
- Password changes are logged for security auditing

**Email Verification:**
- If your email is not verified, you'll see a "Verify Email" button
- Click it to receive a verification email
- Or use the link from your welcome email
- Email verification ensures you can receive important system notifications

---

## Contacts

### Creating a Contact

1. Go to `/hub/contacts` or click the "+ Contact" quick action button on the dashboard
2. Click "Add Contact" button
3. Fill in the contact details:

**Required Fields:**
- **Email** (required) - Must be a valid email address

**Personal Information:**
- First Name
- Last Name
- Phone

**Address Details:**
- Address Line 1
- Address Line 2
- City
- County
- Postcode
- Country

**Church Membership:**
- Membership Status (dropdown)
- Date Joined (date picker)
- Baptism Date (date picker)

**Additional Information:**
- Serving Areas (comma-separated list)
- Giftings (comma-separated list)
- Notes (textarea for additional information)

4. Click "Create Contact"

### Editing a Contact

1. Go to `/hub/contacts`
2. Click on the contact you want to edit
3. Click the "Edit" button
4. Modify any fields as needed
5. Click "Save Changes"

You can also delete a contact from the detail page using the "Delete" button (this action cannot be undone).

### Importing Contacts

You can bulk import contacts from CSV or Excel files:

1. Go to `/hub/contacts/import`
2. Click "Choose File" and select a CSV or Excel (.xlsx, .xls) file
3. The system will automatically detect and map common column names
4. Review and adjust the field mapping if needed
5. Preview the mapped data to ensure accuracy
6. Click "Complete Import" to finish

**Supported File Formats:**
- CSV files (.csv)
- Excel files (.xlsx, .xls)
- Maximum file size: 10MB

**Field Mapping:**
The system automatically detects common column names (e.g., "Email", "First Name", "Last Name", "Phone") and maps them to contact fields. You can manually adjust the mapping before importing.

**Import Process:**
- Duplicate emails are automatically skipped (contacts with the same email already in the system)
- Validation errors are reported with row numbers for easy identification
- Import results show:
  - Number of contacts successfully imported
  - Number of contacts skipped (duplicates)
  - Number of errors encountered

**Important:** Ensure your file has a header row with column names for best results.

### Managing Contacts

**Viewing Contacts:**
- View all contacts in the list view at `/hub/contacts`
- Use the search box to search contacts by name or email
- Click on any contact row to view/edit details
- Contact names in lists are clickable and will navigate to the contact detail page

**Search Functionality:**
- Search by first name, last name, or email address
- Search is case-insensitive
- Results update as you type

**Deleting Contacts:**
- Open a contact's detail page
- Click the "Delete" button
- Confirm the deletion (this action cannot be undone)

---

## Lists

### Creating a List

1. Go to `/hub/lists` or click the "+ List" quick action button on the dashboard
2. Click "Add List" button
3. Enter:
   - **Name** (required) - The name of the list
   - **Description** (optional) - A description of what the list is for
4. Click "Create List"

**Note:** A success notification will appear when the list is created. Lists are initially created empty. You can add contacts to them after creation.

### Adding Contacts to Lists

1. Go to `/hub/lists` and click on the list you want to edit
2. Scroll to the "Contacts in List" section
3. Click the "+ Add Contacts" button
4. Use the search box to find contacts by name or email
5. Check the boxes next to the contacts you want to add
6. Click "Add Selected Contacts"
7. The contacts will be added to the list

**Tips:**
- You can search for contacts while the add contacts section is open
- Click on a contact's name to view their contact details page
- Contacts already in the list won't appear in the available contacts list

### Removing Contacts from Lists

1. Go to `/hub/lists` and click on the list
2. In the "Contacts in List" section, find the contact you want to remove
3. Click the "Remove" button next to the contact's name
4. Confirm the removal

**Note:** Removing a contact from a list does not delete the contact itself, only removes them from this specific list.

### Managing Lists

**Viewing Lists:**
- View all lists at `/hub/lists`
- Use the search box to search lists by name or description
- Click on any list to view/edit details

**Editing Lists:**
- Open a list's detail page
- Click "Edit" to modify the name or description
- Click "Save Changes" when done

**Deleting Lists:**
- Open a list's detail page
- Click "Delete" button
- Confirm the deletion (this action cannot be undone)

**Note:** Deleting a list does not delete the contacts in it, only removes the list grouping.

---

## Newsletters

### Creating a Newsletter

1. Go to `/hub/newsletters` or click the "+ Newsletter" quick action button on the dashboard
2. Click "New Newsletter" button
3. Enter a **Subject** line (required)
4. Use the HTML editor to create your newsletter content
5. Optionally load a template from the "Load Template" dropdown (this will replace your current content)
6. Click "Create Newsletter"

**Note:** A success notification will appear when the newsletter is created. The newsletter will be created as a draft and can be edited or sent later.

### Editing a Newsletter

1. Go to `/hub/newsletters`
2. Click on the newsletter you want to edit
3. If the newsletter is a draft, it will automatically open in edit mode
4. For sent newsletters, click the "Edit" button
5. Modify the subject or content as needed
6. Use the buttons in the top banner:
   - **Save Changes** (Green) - Saves your changes
   - **Save as Template** (Purple) - Saves the newsletter as a reusable template
   - **Back** (White) - Cancel editing and return to view mode
   - **Delete** (Red) - Delete the newsletter

**Note:** Draft newsletters automatically open in edit mode when you click on them.

### Previewing a Newsletter

1. Open a newsletter
2. Click the "Preview" button (indigo button)
3. View how the newsletter will appear to recipients
4. The preview shows the subject, status, and full HTML content
5. Use the "Back to Newsletter" link to return

**Preview Features:**
- See exactly how the newsletter will look when sent
- Check formatting and layout
- Verify personalisation placeholders are correctly placed

### Exporting a Newsletter to PDF

You can export any newsletter as a PDF document for archiving or sharing:

1. Open a newsletter
2. Click the "Preview" button to view the newsletter
3. On the preview page, click the "Export PDF" button (red button with download icon)
4. The PDF will download automatically

**PDF Features:**
- Professional formatting with branded header
- Includes newsletter subject and creation date
- Full HTML content preserved (images, formatting, etc.)
- Footer with generation timestamp
- A4 format with proper margins
- Print-ready layout

**PDF Contents:**
- Header with newsletter subject and creation date
- Complete newsletter HTML content
- Footer with "Eltham Green Community Church - TheHUB Newsletter" and generation date

**Note:** PDF export requires Puppeteer to be installed on the server. If you see an error, contact your system administrator.

### Sending a Newsletter

1. Open a newsletter (the Send button is available for all newsletters, not just drafts)
2. Click the "Send" button (white button with envelope icon)
3. On the send page, select a contact list from the dropdown menu
   - The dropdown shows all available lists with the number of contacts in each list
   - If no lists exist, you'll see a message with a link to create one first
4. Review the newsletter details shown on the send page
5. Click "Send Newsletter" and confirm the action when prompted

**Sending Process:**
- The newsletter will be sent to all contacts in the selected list
- Each email is personalised with the contact's information
- Upcoming rotas (within 7 days) are automatically included for contacts who are assigned to rotas
- Upcoming events (within 7 days) are automatically included
- Sending status and counts are tracked
- The newsletter status changes from "draft" to "sent" after sending
- You'll see a success notification showing how many emails were sent
- Any errors during sending will be displayed

**Personalisation:**
Newsletters automatically include:
- Contact's name in the greeting (using placeholders like `{{firstName}}`, `{{name}}`, etc.)
- Upcoming rotas section (if the contact has rotas in the next 7 days) - shows event title, role, date/time, and a link to view details
- Upcoming events section (public events within the next 7 days) - shows event title, date/time, location, and description
- Links to rota signup pages for assigned rotas

### Deleting a Newsletter

1. Open a newsletter
2. Click the "Delete" button (red button in the top banner)
3. Confirm the deletion
4. The newsletter will be permanently deleted (this action cannot be undone)

**Note:** You can delete newsletters regardless of their status (draft, sent, scheduled).

### Newsletter Templates

Templates allow you to save newsletter designs for reuse.

**Creating a Template from a Newsletter:**
1. Open a newsletter
2. Click "Save as Template" (purple button)
3. Enter a template name (required)
4. Optionally enter a description
5. Click "Save Template"

**Creating a New Template:**
1. Go to `/hub/newsletters/templates`
2. Click "New Template"
3. Enter template name, description, and subject
4. Create the HTML content
5. Click "Create Template"

**Using Templates:**
1. When creating or editing a newsletter, use the "Load Template" dropdown
2. Select a template from the list
3. Confirm that you want to load the template (this will replace your current content)
4. The template's subject and content will be loaded into the form

**Managing Templates:**
- View all templates at `/hub/newsletters/templates`
- Click on a template to view/edit it
- Edit templates to update their content
- Delete templates you no longer need

### HTML Editor Features

The HTML editor provides a rich text editing experience:

**Text Formatting:**
- **Headers**: H1, H2, H3
- **Bold**, *Italic*, <u>Underline</u>, ~~Strikethrough~~
- **Lists**: Ordered and bulleted lists

**Paragraph Alignment:**
- Left align
- Centre align
- Right align
- Justify

**Content:**
- **Links**: Add hyperlinks to text
- **Images**: Insert images using the image picker
- **Clean**: Remove formatting from selected text

**Image Picker:**
- Click the image icon in the toolbar
- Browse available images from your image library
- Search for images by filename
- Click an image to insert it into your newsletter

**Placeholders:**
When creating newsletters, you can use the "Insert Placeholder" button to add personalisation tokens:
- `{{firstName}}` - Contact's first name
- `{{lastName}}` - Contact's last name
- `{{name}}` - Full name (or email if name not available)
- `{{email}}` - Contact's email address
- `{{phone}}` - Contact's phone number
- `{{rotaLinks}}` - Upcoming rotas section (next 7 days) with clickable links
- `{{upcomingEvents}}` - Upcoming events section

**Special Placeholders:**
- `{{rotaLinks}}` automatically generates a formatted section showing all rotas the contact is assigned to in the next 7 days, with clickable links to view rota details. Each rota shows the event title, role, date/time, and a "View Rota Details" button. **Note:** No title is included - add your own heading in the newsletter content.
- `{{upcomingEvents}}` shows upcoming public and internal events within the next 7 days. Each event shows the title, date/time, location (if available), and description. **Note:** No title is included - add your own heading in the newsletter content. Internal events are included so members can see member-only events in newsletters.

**Placeholder Formatting:**
- Both `{{rotaLinks}}` and `{{upcomingEvents}}` are inserted without extra padding or container styling, allowing them to integrate seamlessly with your newsletter content
- If a contact has no upcoming rotas, a message will be displayed instead
- If there are no upcoming events, a message will be displayed instead

---

## Events

### Creating an Event

1. Go to `/hub/events` (defaults to calendar view) or click the "+ Event" quick action button on the dashboard
2. Click "New Event" button
3. Enter event details:
   - **Title** (required) - The event name
   - **Description** (HTML) - Detailed event information
   - **Location** - Where the event takes place
   - **Visibility** - Choose from:
     - **Public** - Visible to everyone on the public website calendar
     - **Internal** - Visible in the hub and in newsletters (for members/contacts only), but NOT on public calendar
     - **Private** - Visible only in the hub (admin only)
4. Set the first occurrence:
   - **Start Date & Time** (required)
   - **End Date & Time** (optional)
5. Configure recurrence (optional):
   - **Repeat Type**: None, Daily, Weekly, Monthly, or Yearly
   - **Repeat Interval**: How often (e.g., every 2 weeks)
   - **End Condition**: 
     - Never (repeats indefinitely)
     - On date (specify end date)
     - After number of occurrences (specify count)
   - **For Weekly**: Select day(s) of the week
   - **For Monthly**: Specify day of month or week of month
6. Click "Create Event"

**Recurrence Examples:**
- **Weekly Service**: Repeat weekly on Sunday, never ends
- **Monthly Meeting**: Repeat monthly on the first Monday, ends after 12 occurrences
- **Daily Devotion**: Repeat daily, ends on a specific date

### Event Calendar Views

The events section defaults to a calendar view with multiple viewing options:

**Month View:**
- See all events in a monthly calendar grid
- Navigate between months using arrow buttons
- Click on a date to see events for that day
- Click on an event to view/edit it

**Week View:**
- See events in a weekly calendar
- Navigate between weeks
- View events by day of the week

**Agenda View:**
- List view of upcoming events
- Shows events in chronological order
- Displays event details at a glance

**Year View:**
- Overview of events by year
- Navigate between years
- See events across the entire year

**Switching Views:**
- Use the view selector dropdown to switch between Month, Week, Agenda, and Year views
- Use the date picker to jump to a specific month/year
- Use arrow buttons to navigate forward/backward

**List View:**
- Click "List View" button to see all events in a table format
- Search and filter events
- Click on events to view/edit

### Adding Occurrences

You can add additional occurrences to an event:

1. Open an event
2. Click "Add Occurrence"
3. Enter occurrence details:
   - **Start Date & Time** (required)
   - **End Date & Time** (optional)
   - **Location Override** (optional) - Different location for this occurrence
4. Configure recurrence to create multiple occurrences at once:
   - Same recurrence options as when creating an event
   - Useful for adding a series of occurrences
5. Click "Save"

**Recurring Occurrences:**
When adding occurrences, you can use recurrence to create multiple occurrences in one go. For example, add occurrences for "Every Tuesday for the next 4 weeks".

### Editing Occurrences

1. Open an event
2. Scroll to the "Occurrences" section
3. Click on an occurrence
4. Modify the date, time, or location
5. Click "Save Changes"

You can also delete individual occurrences without affecting the event or other occurrences.

### Downloading Events

You can download events as ICS (iCalendar) files for import into calendar applications:

1. Open an event
2. Click "Download ICS" button
3. The file will download with all occurrences included
4. Import the file into Google Calendar, Outlook, Apple Calendar, or other calendar applications

**ICS Files Include:**
- Event title and description
- All occurrences with dates and times
- Location information
- Event visibility settings

---

## Rotas

### Creating a Rota

1. Go to `/hub/rotas` or click the "+ Rota" quick action button on the dashboard
2. Click "New Rota" button
3. Select an **Event** from the dropdown (required)
4. Enter:
   - **Role** (required) - The role or position (e.g., "Worship Leader", "Sound Technician")
   - **Capacity** (required) - How many people are needed
   - **Owner** (optional) - The contact who will be notified when this rota is updated. Use the search bar to quickly find contacts by name or email.
   - **Notes** (optional) - Additional information about the rota
5. Click "Create Rota"

**Note:** Rotas are linked to events. You can create multiple rotas for the same event (e.g., different roles).

### Managing Rotas

**Viewing Rotas:**
- View all rotas at `/hub/rotas`
- See which event each rota is for
- View role, capacity, and current assignments

**Editing Rotas:**
- Open a rota's detail page
- Click "Edit" to modify role, capacity, owner, or notes
- Use the search bar in the Owner field to quickly find contacts
- Click "Save Changes" (button is located at the top of the page)

**Assigning Volunteers:**
- Open a rota
- View the list of assigned volunteers
- Assignees are clickable links that take you to their contact details page
- Use bulk invitations to send signup links to multiple contacts

**Deleting Rotas:**
- Open a rota's detail page
- Click "Delete" button
- Confirm the deletion

### Bulk Invitations

Send rota signup invitations to multiple contacts at once:

1. Go to `/hub/rotas/invite`
2. Select an **Event** from the dropdown
3. Select one or more **Rotas** for that event
4. Optionally select specific **Occurrences** (if you only want to invite for certain dates)
5. Select a **Contact List** to send invitations to
6. Click "Send Invitations"

**Invitation Process:**
- Each contact receives a personalised email invitation
- Emails include:
  - Greeting with contact's name
  - Details about the assigned rota(s)
  - Links to other upcoming rotas (within 7 days)
  - Unique signup link for each rota
- Contacts can click the link to sign up without needing to log in

**Public Signup:**
- Volunteers receive unique token-based signup links
- They can sign up at `/signup/rota/[token]` without logging in
- The signup page shows rota details and allows them to confirm their participation

**Rota Owner Notifications:**
- When a rota has an owner assigned, they receive email notifications when:
  - The rota is updated (role, capacity, notes changed)
  - New volunteers sign up for the rota
  - Volunteers are removed from the rota
- Email notifications include:
  - Event name and occurrence date/time
  - Rota details (role, capacity)
  - Complete list of all assignees with their names and emails
  - Assignees grouped by occurrence (if applicable)
  - Link to view the rota in the hub

---

## Forms

### Creating a Form

1. Go to `/hub/forms` or click the "+ Form" quick action button on the dashboard
2. Click "New Form" button
3. Enter:
   - **Form Name** (required)
   - **Description** (optional) - Explain what the form is for
4. Add form fields:
   - Click "Add Field" to add a new field
   - Configure each field:
     - **Field Type**: text, email, phone, date, number, textarea, select, checkbox, radio
     - **Label** - What users will see
     - **Name** - Internal field name (auto-generated from label)
     - **Required** - Whether the field must be filled
     - **Placeholder** - Hint text for the field
     - **Options** - For select, checkbox, and radio fields
   - Reorder fields using up/down arrows
   - Edit or remove fields as needed
5. Optionally enable **"Requires Safeguarding Encryption"** for sensitive data (e.g., children's work forms)
6. Click "Create Form"

**Field Types:**
- **Text**: Single-line text input
- **Email**: Email address input with validation
- **Phone**: Phone number input
- **Date**: Date picker
- **Number**: Numeric input
- **Textarea**: Multi-line text input
- **Select**: Dropdown menu
- **Checkbox**: Multiple selection checkboxes
- **Radio**: Single selection radio buttons

**Safeguarding Forms:**
Forms marked as "Requires Safeguarding Encryption" will have all submission data encrypted using AES-256-GCM encryption. This is essential for forms collecting sensitive information about children or vulnerable adults.

### Viewing Form Submissions

1. Go to `/hub/forms`
2. View the "Latest Form Submissions" section on the main forms page
3. Click on a submission to view full details
4. For safeguarding forms, data is automatically decrypted for viewing (encryption is transparent to admins)

**Submission Details:**
- View all submitted field values
- See submission timestamp
- View which form was submitted
- For safeguarding forms, see decrypted data securely

**Managing Submissions:**
- View individual submissions at `/hub/forms/[formId]/submissions/[submissionId]`
- All submissions are stored and can be reviewed later
- Safeguarding form data remains encrypted in storage

### Public Form Submission

Forms can be accessed publicly for submission without requiring login:

1. Forms are available at `/forms/[formId]`
2. Anyone with the link can submit the form
3. No login required for form submission
4. Submitted data is stored in the system
5. Admins can view all submissions in the Hub

**Public Access:**
- Forms are designed to be shared via links
- Perfect for collecting information from church members, visitors, or event attendees
- All submissions are tracked and can be reviewed by admins

---

## Public Signup

Volunteers receive email invitations with unique tokens for rota signup.

**Signup Process:**
1. Volunteer receives an email invitation
2. Email includes personalised greeting and rota details
3. Email shows links to other upcoming rotas (within 7 days)
4. Volunteer clicks the unique signup link
5. They are taken to `/signup/rota/[token]`
6. They can view rota details and confirm participation
7. No login required - the token provides secure access

**Email Features:**
- Personalised with volunteer's name
- Shows rota role and event details
- Includes links to other upcoming rotas
- Direct signup link for easy access
- Professional formatting

**Security:**
- Each signup link contains a unique, secure token
- Tokens are single-use or time-limited
- No need for volunteers to create accounts or remember passwords

---

## Help and Documentation

The Hub includes comprehensive built-in documentation:

**Accessing Help:**
1. Click "Help" in the main navigation
2. Browse available documentation:
   - **User Guide** (this document) - How to use The Hub
   - **Admin Guide** - Administrative tasks and setup
   - **Technical Documentation** - Technical details for developers
   - **Security Guide** - Security best practices
   - **Security Audit** - Security audit report and recommendations

**Documentation Features:**
- Scrollable document viewer
- Easy navigation between documents
- Search functionality (browser search)
- Always up-to-date with latest features

**Getting Support:**
- Review the documentation for answers to common questions
- Check the Admin Guide for setup and configuration help
- Refer to the Security Guide for security-related questions

---

## Tips and Best Practices

**Contacts:**
- Use consistent naming conventions for easier searching
- Import contacts in bulk when setting up the system
- Keep contact information up to date
- Use notes to track important information about contacts

**Lists:**
- Create lists for different groups (e.g., "Youth Group", "Worship Team", "Small Group Leaders")
- Use descriptive list names
- Regularly update lists as membership changes

**Newsletters:**
- Create templates for commonly used newsletter formats
- Use personalisation placeholders to make emails more engaging
- Preview newsletters before sending
- Export newsletters to PDF for archiving or sharing
- Test with a small list first before sending to everyone

**Events:**
- Use recurrence for regularly scheduled events
- Set appropriate visibility:
  - **Public** - For events open to the general public
  - **Internal** - For member-only events (appears in newsletters but not public calendar)
  - **Private** - For admin-only planning events
- Add detailed descriptions to help people understand the event
- Download ICS files to share events externally

**Rotas:**
- Create rotas well in advance
- Send invitations early to give volunteers time to respond
- Use bulk invitations to efficiently manage multiple rotas
- Link rotas to events for better organisation

**Forms:**
- Use safeguarding encryption for any forms collecting information about children or vulnerable adults
- Test forms before making them public
- Use clear field labels and helpful placeholders
- Keep forms simple and focused

---

## Keyboard Shortcuts

While The Hub doesn't have specific keyboard shortcuts, you can use standard browser shortcuts:
- **Ctrl/Cmd + F**: Search on the current page
- **Ctrl/Cmd + Click**: Open links in new tabs
- **Backspace**: Go back (in some browsers)
- **Esc**: Close modals or dialogs

---

## Troubleshooting

**Can't log in:**
- Check that you're using the correct email and password
- Use the "Forgot password?" link on the login page to reset your password
- Ensure your account hasn't been locked (too many failed attempts)
- If locked, contact an administrator to unlock your account
- Verify that your email address has been verified (check for verification email)

**Form not submitting:**
- Check that all required fields are filled
- Ensure you have a stable internet connection
- Try refreshing the page and submitting again

**Newsletter not sending:**
- Verify that Resend API key is configured
- Check that the contact list has contacts
- Ensure newsletter is in draft status
- Check email service status

**Import not working:**
- Verify file format (CSV or Excel)
- Check file size (must be under 10MB)
- Ensure file has a header row
- Review error messages for specific issues

**Data not saving:**
- Check your internet connection
- Ensure you're still logged in (session may have expired)
- Try refreshing the page
- Contact support if the issue persists

---

## Additional Resources

- **Admin Guide**: For system setup and configuration
- **Technical Documentation**: For developers and technical details
- **Security Guide**: For security best practices
- **Security Audit**: For security recommendations and status

---

*Last Updated: January 2025*

---

## Recent Updates

**January 2025:**
- Added PDF export functionality for newsletters
- Implemented forgot password feature with email reset links
- Added comprehensive admin user management system
- Enhanced security with email verification for admin users
- Added admin profile page for self-service account management
