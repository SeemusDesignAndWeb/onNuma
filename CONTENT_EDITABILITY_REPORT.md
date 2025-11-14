# Content Editability Report

## ✅ Currently Editable in Admin

### Pages Admin (`/admin/pages`)
- ✅ Page ID (URL slug)
- ✅ Title
- ✅ Hero Messages (rotating subtitles)
- ✅ Content (rich text editor)
- ✅ Hero Image URL
- ✅ Meta Description
- ❌ **MISSING: heroTitle** (with HTML support for colored text)
- ❌ **MISSING: heroSubtitle**
- ❌ **MISSING: heroButtons** (array of buttons with text, link, style, target)
- ❌ **MISSING: heroOverlay** (opacity percentage)

### Settings Admin (`/admin/settings`)
- ✅ Site Name
- ✅ Primary Color
- ✅ Team Description
- ✅ Team Hero Title
- ✅ Team Hero Subtitle
- ✅ Team Hero Buttons
- ✅ YouTube Playlist ID
- ✅ YouTube Channel ID
- ✅ Podcast settings

### Other Admin Pages
- ✅ Hero Slides (`/admin/hero-slides`)
- ✅ Services (`/admin/services`)
- ✅ Activities (`/admin/activities`)
- ✅ Team Members (`/admin/team`)
- ✅ Podcasts (`/admin/podcasts`)
- ✅ Testimonials (`/admin/testimonials`)
- ✅ Images (`/admin/images`)

## ❌ Hardcoded Content (Not Editable)

### 1. Home Page - About Component (`src/lib/components/About.svelte`)
**Location:** Lines 17-39
- ❌ "Our Story" label
- ❌ "Welcome to Eltham Green Community Church" heading
- ❌ All paragraph content (3 paragraphs)
- ❌ Image URL (hardcoded Cloudinary URL)

**Recommendation:** Move to database as a page section or create a dedicated "About" content in settings.

### 2. Home Page - Menu Component (`src/lib/components/Menu.svelte`)
**Location:** Lines 11-48, 62-68
- ❌ "What We Offer" label
- ❌ "Our Services & Programs" heading
- ❌ "Worship, Community & Growth" subtitle
- ❌ Entire services array (6 hardcoded services with name, description, time, image)

**Recommendation:** This should use the Services from database (already editable in `/admin/services`), but the component is using hardcoded data instead.

### 3. Community Groups Page (`src/routes/community-groups/+page.svelte`)
**Location:** Lines 155-255 (Groups Schedule Section)
- ❌ "Join Us" label
- ❌ "Community Group Times" heading
- ❌ "Find a group that fits your schedule" subtitle
- ❌ All 4 group cards (Tuesday, Wednesday, Friday x2) with:
  - Day names
  - Times (7:30 PM)
  - Descriptions

**Location:** Lines 257-313 (Benefits Section)
- ❌ "Why Join" label
- ❌ "What You'll Experience" heading
- ❌ "Community Groups are at the heart of how we do church" subtitle
- ❌ Three benefit cards:
  - "Love God" with description
  - "Love Each Other" with description
  - "Love Our Community" with description

**Recommendation:** Add these sections to the page's sections array in database, or create a dedicated admin interface for community group schedules and benefits.

### 4. Footer Component (`src/lib/components/Footer.svelte`)
**Location:** Lines 27, 44, 69
- ❌ "Contact" heading
- ❌ "Service Times" heading
- ❌ "Quick Links" heading
- ✅ Contact info (address, phone, email) - editable via contactInfo prop
- ✅ Service times - editable via serviceTimes prop

**Recommendation:** Footer headings could be moved to settings, but they're likely fine as-is since they're structural labels.

## 🔧 Required Admin Interface Updates

### Priority 1: Add Missing Page Hero Fields
The admin pages form needs to support:
1. **Hero Title** - Text input with HTML support (for colored spans)
2. **Hero Subtitle** - Text input
3. **Hero Buttons** - Array editor with fields:
   - Text
   - Link
   - Style (primary/secondary)
   - Target (_self/_blank)
4. **Hero Overlay** - Number input (0-100)

### Priority 2: Fix Menu Component
The Menu component should load services from the database instead of using hardcoded array.

### Priority 3: Make About Section Editable
Either:
- Add About content to settings/admin
- Or create it as a page section that can be edited

### Priority 4: Make Community Groups Sections Editable
Add admin interface for:
- Community group schedule times
- Benefits/experience cards

## 📝 Summary

**Total Hardcoded Content Areas:** 4 major areas
- About component (home page)
- Menu/Services component (home page) 
- Community Groups schedule section
- Community Groups benefits section

**Missing Admin Fields:** 4 fields in pages admin
- heroTitle
- heroSubtitle  
- heroButtons
- heroOverlay

**Recommendation:** Start with Priority 1 (add missing hero fields to admin) as this affects all pages. Then address the hardcoded components.

