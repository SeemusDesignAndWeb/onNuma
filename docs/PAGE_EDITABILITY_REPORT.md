# Page Editability Report

## ✅ Fully Editable Pages (via `/admin/pages`)

### 1. **im-new** (`/im-new`)
- ✅ Hero section (title, subtitle, messages, buttons, image, overlay)
- ✅ Welcome section (from sections)
- ✅ What to Expect columns (from sections)
- ❌ **HARDCODED**: "For All Ages" section (lines 230-294)
  - Service time "11:00"
  - "Sunday Service" text
  - "Doors open at 10:30am"
  - Service details (refreshments, worship, children's groups)
  - Adventurers/Explorers age groups
- ❌ **HARDCODED**: "Get Connected" section (lines 297-315)
  - Title, description, and CTA text

### 2. **church** (`/church`)
- ✅ Hero section (title, subtitle, buttons, image, overlay)
- ✅ History section (from sections)
- ✅ Other sections (from sections)
- ❌ **HARDCODED**: Section images (lines 180-198)
  - Hardcoded Cloudinary URLs for card images

### 3. **activities** (`/activities`)
- ✅ Hero section (title, subtitle, buttons, image, overlay)
- ✅ Intro section (from sections)
- ✅ Activities list (from `/admin/activities`)
- ❌ **HARDCODED**: "Serving Together" card (lines 98-106)
  - Icon, title, and description
- ❌ **HARDCODED**: Section labels and titles (lines 119-125)
  - "What We Offer", "Our Activities", description
- ❌ **HARDCODED**: CTA section (lines 195-215)
  - Title, description, and button text

### 4. **audio** (`/audio`)
- ✅ Hero section (title, subtitle, buttons, image, overlay)
- ✅ Podcasts list (from `/admin/podcasts`)
- ✅ Fully editable via pages admin

### 5. **media** (`/media`)
- ✅ Hero section (title, subtitle, buttons, image, overlay)
- ✅ Videos list (from YouTube playlist)
- ✅ Fully editable via pages admin

### 6. **team** (`/team`)
- ✅ Hero section (from settings)
- ✅ Team description (from settings)
- ✅ Team members (from `/admin/team`)
- ✅ Fully editable

### 7. **community-groups** (`/community-groups`)
- ✅ Hero section (title, subtitle, messages, buttons, image, overlay)
- ✅ Intro section (from sections) - **NOW EDITABLE** (just added)
- ✅ Details section (from sections) - **NOW EDITABLE** (just added)
- ✅ Community groups list (from `/admin/community-groups`)
- ❌ **HARDCODED**: "Join Us" section labels (lines 160-167)
  - "Join Us" label, "Community Group Times" title, description
- ❌ **HARDCODED**: "What You'll Experience" section (lines 204-260)
  - Title, description, and all 3 benefit cards (Love God, Love Each Other, Love Our Community)

## ❌ Partially Editable Pages

### 8. **Home Page** (`/`)
- ✅ Hero slides (from `/admin/hero-slides`)
- ✅ Featured events (from events)
- ❌ **HARDCODED**: About component (`src/lib/components/About.svelte`)
  - "Our Story" label
  - "Welcome to Eltham Green Community Church" heading
  - All 3 paragraphs of content
  - Image URL
- ✅ Menu/Services component (`src/lib/components/Menu.svelte`)
  - Uses services from database (editable via `/admin/services`)
  - ❌ **HARDCODED**: Section labels ("What We Offer", "Our Services & Programs", "Worship, Community & Growth")

## Summary of Hardcoded Content

### High Priority (Affects User Experience)
1. **Home Page About Section** - Complete section hardcoded
2. **im-new "For All Ages" Section** - Service times and details
3. **im-new "Get Connected" Section** - CTA section
4. **community-groups "What You'll Experience"** - Benefits section with 3 cards
5. **activities CTA Section** - Call to action section

### Medium Priority (Labels/Text)
1. **Home Page Menu Labels** - Section headings
2. **activities Section Labels** - "What We Offer", etc.
3. **community-groups Section Labels** - "Join Us", etc.
4. **activities "Serving Together" Card** - Icon card content

### Low Priority (Images)
1. **church Page Card Images** - Hardcoded Cloudinary URLs in cards

## Recommendations

### Immediate Actions Needed:
1. ✅ **DONE**: Add section editing for community-groups page (intro and details sections)
2. **TODO**: Add "For All Ages" section editing for im-new page
3. **TODO**: Add "Get Connected" section editing for im-new page  
4. **TODO**: Add "What You'll Experience" section editing for community-groups page
5. **TODO**: Add CTA section editing for activities page
6. **TODO**: Make About component editable (move to database or settings)
7. **TODO**: Make section labels editable (add to page settings or sections)

### Implementation Approach:
- For sections like "For All Ages" and "Get Connected" on im-new: Add as additional sections in the sections array
- For "What You'll Experience" on community-groups: Add as a new section type (e.g., `type: 'benefits'` with columns)
- For About component: Either create a dedicated settings section or add it as a page section
- For labels: Add a `labels` object to page data structure for customizable section labels

