# AISafety.com WebFlow to Next.js Migration Status

> Last updated: January 10, 2026 (schemas completed)

## Overview

This document tracks the progress of migrating AISafety.com from WebFlow to Next.js. The live WebFlow site contains 12+ pages with various interactive features, database integrations, and filtering capabilities.

---

## Migration Progress Summary

| Page                                       | Status   | Priority | Complexity |
| ------------------------------------------ | -------- | -------- | ---------- |
| Homepage (`/`)                             | **DONE** | High     | Medium     |
| Events & Training (`/events-and-training`) | **DONE** | High     | Low        |
| Field Map (`/map`)                         | **DONE** | High     | High       |
| Communities (`/communities`)               | **TODO** | High     | Medium     |
| Self-Study (`/self-study`)                 | **TODO** | High     | Medium     |
| Jobs (`/jobs`)                             | **TODO** | High     | High       |
| Funding (`/funding`)                       | **TODO** | Medium   | Medium     |
| Media Channels (`/media-channels`)         | **TODO** | Medium   | Medium     |
| Advisors (`/advisors`)                     | **TODO** | Medium   | Medium     |
| Projects (`/projects`)                     | **TODO** | Medium   | Medium     |
| Donation Guide (`/donation-guide`)         | **TODO** | Low      | Medium     |
| About (`/about`)                           | **TODO** | Low      | Low        |
| Feedback (`/feedback`)                     | **TODO** | Low      | Low        |

**Progress: 3/13 pages complete (~23%)**

---

## Completed Pages

### 1. Homepage (`/`)

**File:** `src/app/page.tsx`

**Features implemented:**

- Hero section with title and description
- Events & training card with featured event (EAGxAmsterdam)
- Ecosystem map preview card
- Communities card with featured community (AI Alignment Slack)
- Self-study card with featured course (Blue Dot Impact)
- Jobs card
- Media channels card
- Funding card with featured funder (SFF)
- Advisors card
- Volunteer projects card with featured project
- Donation guide card
- AISafety.info CTA section
- Dynamic "last updated" timestamps via API

**Notes:**

- All cards link to their respective pages (some links currently 404)
- Featured items are hardcoded - could be made dynamic in future

---

### 2. Events & Training (`/events-and-training`)

**File:** `src/app/events-and-training/page.tsx`

**Features implemented:**

- Page title and intro paragraph
- "Last updated" dynamic timestamp
- Action links (newsletter, suggest entry, suggest correction)
- Airtable embed for "All upcoming events" (mobile & desktop versions)
- Airtable embed for "Open for application/registration"
- Link to self-study section
- Responsive design (hide desktop embed on mobile)

**Notes:**

- Uses Airtable embeds rather than native data fetching
- Could be enhanced with native Next.js data fetching for better UX

---

### 3. Field Map (`/map`)

**Files:**

- `src/app/map/page.tsx` - Main page component
- `src/app/map/D3Map.tsx` - Interactive D3.js map
- `src/app/map/page.module.css` - Map-specific styles
- `src/app/api/map/route.ts` - Airtable API integration

**Features implemented:**

- Full D3.js interactive map with zoom/pan
- Organization logos positioned on map
- Area labels (Conceptual Cliffs, Research Range, etc.)
- Tooltip on hover showing org details
- Cards grid below map with search
- Category filters (16 categories)
- Status filters (Active/Inactive)
- "Suggest entry" and "Suggest correction" links
- "View raw data" link to Airtable
- Responsive design
- Zoom controls (+, -, recenter)

**API Integration:**

- Fetches from Airtable with 5-minute cache
- Handles pagination for 100+ records
- Extracts "magic rows" for metadata

---

## Pages To Be Implemented

### 4. Communities (`/communities`)

**Priority:** High
**Estimated complexity:** Medium-High

**Required features:**

- **Mapbox geographic map** showing in-person community locations (top of page)
  - Interactive world map with zoom controls
  - Community markers positioned geographically
  - "View online communities" button to skip to cards section
- Featured community cards (AI Alignment Slack, LessWrong)
- Community cards with logo, name, description
- Platform type display (Discord, Slack, Facebook, etc.)
- Activity level indicators (Very active, Active, Semi-active, Inactive)
- Focus type (Main focus vs Partial focus on AI safety)
- **Filtering system:**
  - Text search by title, description, or location
  - Type filter: Online (56), In-person (142)
  - Platform filter: Discord (51), Facebook (16), Forum (2), Gather, Reddit, Slack, Telegram, etc.
  - Focus filter (Main/Partial)
  - Activity level filter
- Dynamic filter counts
- Related resources sidebar (Map of LessWrong groups, Map of EA groups)
- Suggest entry/correction forms (Airtable links)

**Data source:** Likely Airtable (need to identify table/view IDs)

**Implementation approach:**

1. Create API route similar to `/api/map`
2. Integrate Mapbox GL JS for geographic map
3. Build filterable card grid component
4. Add responsive sidebar filters

**Additional dependencies needed:**

- `mapbox-gl` or `react-map-gl` for Mapbox integration
- Mapbox API token (environment variable)

---

### 5. Self-Study (`/self-study`)

**Priority:** High
**Estimated complexity:** Medium

**Required features:**

- Course cards with thumbnail, title, description
- Category tags (Technical Alignment, Governance, Introductory, Strategy)
- Creator/organization attribution
- **Filtering system:**
  - Category filter (Technical Alignment, Governance, Strategy, Introductory)
  - Type filter (Curriculum, Reading List)
  - Text search by name or organizer
- Related resources sidebar
- Suggest entry/correction forms

**Featured content:**

- AI Alignment Forum curated sequences
- BlueDot Impact courses

**Data source:** Likely Airtable

---

### 6. Jobs (`/jobs`)

**Priority:** High
**Estimated complexity:** High (largest dataset - 500+ jobs)

**Required features:**

- Job cards with title, organization, requirements, location, date
- **Filtering system:**
  - Skill Set filter (data science, legal, policy, research, software engineering, etc.)
  - Experience Level filter (entry-level, junior, mid, senior)
  - Role Type filter (full-time, part-time, internship, fellowship, volunteering)
  - Work Location filter (remote, on-site, specific cities)
  - Text search
- Dynamic filter counts
- Organization logos
- Direct links to job postings
- localStorage caching for performance

**Organizations represented:**

- Anthropic, Google DeepMind, xAI
- MIT, Stanford, RAND Corporation
- UK AI Security Institute, Future of Life Institute
- Various startups

**Data source:** Likely Airtable (large dataset)

**Implementation notes:**

- Consider pagination or infinite scroll for 500+ jobs
- May need optimized filtering for large dataset
- Consider server-side filtering for performance

---

### 7. Funding (`/funding`)

**Priority:** Medium
**Estimated complexity:** Medium

**Required features:**

- Funder cards with logo, name, description
- Application status (accepting/closed) with deadlines
- Funding type classification
- **Filtering system:**
  - Recipient type (researchers, individuals, startups, academics, nonprofits)
  - Application status (accepting/closed)
  - Organization type (Fund, Grant program, Incubator, VC, Platform, Fellowship)
  - Text search
- Featured funders section at top
- Direct application links

**Featured funders:**

- Coefficient Giving (highlighted as "Largest funder in x-risk reduction")
- Survival and Flourishing Fund

**Additional resources:**

- Newsletter signup
- Articles like "An overview of the funding situation"

**Data source:** Likely Airtable

---

### 8. Media Channels (`/media-channels`)

**Priority:** Medium
**Estimated complexity:** Medium

**Required features:**

- Media cards with name, description, type
- **Filtering system:**
  - Type filter (Article, Blog, Book, Forum, Newsletter, Podcast, Twitter/X list, YouTube channel)
  - Text search
- Dynamic filter counts
- Featured recommendations at top

**Content types:**

- Forums (AI Alignment Forum, LessWrong, EA Forum)
- YouTube channels (Robert Miles AI Safety, Rational Animations)
- Podcasts (80,000 Hours, AXRP, Dwarkesh Podcast)
- Newsletters (Import AI, CAIS Newsletter, policy.ai)
- Books (Superintelligence, The Precipice, Human Compatible)
- Blogs (Cold Takes, Bounded Regret)

**Featured content:**

- "Don't Worry About the Vase" blog
- "AI Safety Playlist" on YouTube

**Data source:** Likely Airtable

---

### 9. Advisors (`/advisors`)

**Priority:** Medium
**Estimated complexity:** Medium

**Required features:**

- Advisor cards with name, organization, description
- **Filtering system:**
  - Focus filter (Career/contribution, Other)
  - Status filter (Active, Inactive)
  - Text search
- Dynamic result counts
- Related resources (career advice videos, events link)

**Featured advisors:**

- 80,000 Hours
- AI Safety Quest
- Probably Good

**Additional advisor types:**

- Career/contribution advisors (Successif, CAES, Nonlinear, HIP)
- Technical/specialized advisors
- Coaching services
- Student support (Effective Thesis)

**Data source:** Likely Airtable

---

### 10. Projects (`/projects`)

**Priority:** Medium
**Estimated complexity:** Medium

**Required features:**

- Project cards with name, description, contact info, status
- Status indicators (Active, Paused, Seeking owner)
- Contact person and email
- External project links
- **Filtering system:**
  - Status filter
  - Text search
- Featured projects section
- Suggest entry form

**Featured projects:**

- Alignment Research Dataset (contact: Olivier Coutu)
- AI Safety Feed (contact: Matt Brooks)

**Other projects:**

- AI Safety Information Hub
- AI Safety Quest
- Network of High Impact Spaces
- Comprehensive AI Risk Understanding Assessment
- Stampede Discord Bot

**Data source:** Likely Airtable

---

### 11. Donation Guide (`/donation-guide`)

**Priority:** Low
**Estimated complexity:** Medium

**Required features:**

- **Tabbed interface** with donation tiers:
  - $1–1,000
  - $1,000–10,000
  - $10,000–100,000
  - $100,000+
- Time availability categories within each tier:
  - 5 minutes–1 hour
  - 1–50 hours
  - Ongoing commitment
  - Major focus
- Tailored recommendations per tier/time combo
- Links to giving platforms (AI Risk Mitigation Fund, Manifund, GiveWiki)
- Donor lottery information
- Responsive design

**Implementation notes:**

- Could be implemented as static content with tab state management
- No external data source needed (content-driven page)

---

### 12. About (`/about`)

**Priority:** Low
**Estimated complexity:** Low

**Required features:**

- Mission statement and team description
- "Our views" section
- Financial stance section
- Community engagement info (Discord link, feedback form)
- Contact information (project lead: Søren Elverlin)
- Calendar link for scheduling meetings
- Email contact

**Implementation notes:**

- Mostly static content page
- No external data integration needed

---

### 13. Feedback (`/feedback`)

**Priority:** Low
**Estimated complexity:** Low

**Required features:**

- Links to suggestion form (Airtable)
- Anonymous feedback option
- Donate link (Every.org)

**Implementation notes:**

- Very simple page with external links
- Could be combined with About page

---

## Shared Components Status

### Completed Components

| Component    | File                             | Status   |
| ------------ | -------------------------------- | -------- |
| Navigation   | `src/components/Navigation.tsx`  | **DONE** |
| Footer       | `src/components/Footer.tsx`      | **DONE** |
| Last Updated | `src/components/LastUpdated.tsx` | **DONE** |
| Up Button    | `src/components/UpButton.tsx`    | **DONE** |

### Components To Build

| Component      | Description                                | Priority |
| -------------- | ------------------------------------------ | -------- |
| FilterSidebar  | Reusable filter sidebar for database pages | High     |
| SearchBar      | Consistent search input component          | High     |
| Card           | Generic card component for listings        | High     |
| FilterCheckbox | Checkbox with count badge                  | Medium   |
| Tabs           | Tab interface for donation guide           | Low      |
| FeaturedCard   | Highlighted card for featured items        | Medium   |

---

## API Routes Status

### Completed

| Route                      | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `/api/map`                 | Fetches map organizations from Airtable |
| `/api/last-updated/events` | Gets last updated date for events       |
| `/api/last-updated/map`    | Gets last updated date for map          |

### Routes To Build

| Route                 | Purpose                         | Priority |
| --------------------- | ------------------------------- | -------- |
| `/api/communities`    | Fetch communities from Airtable | High     |
| `/api/self-study`     | Fetch courses from Airtable     | High     |
| `/api/jobs`           | Fetch jobs from Airtable        | High     |
| `/api/funding`        | Fetch funders from Airtable     | Medium   |
| `/api/media-channels` | Fetch media from Airtable       | Medium   |
| `/api/advisors`       | Fetch advisors from Airtable    | Medium   |
| `/api/projects`       | Fetch projects from Airtable    | Medium   |

---

## Data Schemas (Extracted from Live Site)

### Communities Schema

```typescript
interface Community {
  widget: 'community-card'
  title: string
  description: string
  link: string // Join URL
  type: 'online' | 'in-person'
  platforms: string // "discord", "slack", "facebook", etc.
  status: 'very-active' | 'active' | 'semi-active' | 'inactive'
  focus: 'main-focus-is-ai-safety' | 'partial-focus-on-ai-safety'
  location: string // Physical location (if in-person)
  latitude: string // For map positioning
  longitude: string // For map positioning
  modified: string // "December 16, 2025"
}
// Total: ~198 communities (56 online, 142 in-person)
```

### Jobs Schema

```typescript
interface Job {
  widget: 'job-card'
  title: string
  description: string
  org: string // Organization name
  location: string // "Zurich, Switzerland", etc.
  work_location: 'on-site' | 'remote' | 'hybrid'
  skillset: string // Comma-separated: "software-engineering,information-security"
  experience: string // "entry-level" | "junior" | "mid" | "senior" | "multiple-experience-levels"
  role: string // "full-time" | "part-time" | "internship" | "fellowship" | "volunteering" | "funding"
  modified: string // "January 9, 2026"
}
// Total: ~710 jobs
// Skills: software-engineering, research, policy, operations, legal, finance, outreach, management, information-security, strategy, other
```

### Self-Study Schema

```typescript
interface Course {
  widget: 'course-card'
  title: string
  summary: string
  organizer: string // "Google DeepMind", "BlueDot Impact", etc.
  category: 'technical-alignment' | 'introductory' | 'governance' | 'strategy'
  course_type: 'curriculum' | 'reading-list'
  modified: string // "December 17, 2025"
}
// Total: 26 courses
```

### Funding Schema

```typescript
interface Funder {
  widget: 'funding-card'
  title: string
  description: string
  recipient: string // "Any", specific types, or empty
  taking_applications: 'yes-rolling-basis' | 'yes-deadline' | 'no' | 'unknown'
  funding_type:
    | 'fund'
    | 'platform'
    | 'grant-program'
    | 'vc'
    | 'incubator'
    | 'fellowship'
  eligible_type: string // "any", "researchers", "nonprofits", etc.
  modified: string
}
// Total: 63 funders
```

### Media Channels Schema

```typescript
interface MediaChannel {
  widget: 'media-card'
  name: string
  description: string
  link: string
  type:
    | 'forum'
    | 'youtube'
    | 'podcast'
    | 'newsletter'
    | 'blog'
    | 'book'
    | 'twitter-list'
    | 'article'
  sort: string // Sort order number
  modified: string
}
// Total: 77 media channels
```

### Advisors Schema

```typescript
interface Advisor {
  widget: 'talk-to-a-human-card'
  title: string
  description: string
  focus: 'career-contribution' | 'other'
  status: 'active' | 'inactive'
  modified: string
}
// Total: 20 advisors
```

### Projects Schema

```typescript
interface Project {
  widget: 'project-card'
  title: string
  description: string
  status: 'active' | 'seeking-owner' | 'paused'
  modified: string
}
// Total: 32 projects
```

### Donation Guide Structure

```typescript
// Tab-based static content page
interface DonationGuide {
  tabs: [
    { id: 'Tab 1'; label: '$1–1,000'; contentLength: 3610 },
    { id: 'Tab 2'; label: '$1,000–10,000'; contentLength: 3534 },
    { id: 'Tab 3'; label: '$10,000–100,000'; contentLength: 1785 },
    { id: 'Tab 4'; label: '$100,000+'; contentLength: 2927 },
  ]
}
// Static content, no database integration needed
```

---

### Filter Values Reference

**Communities filters:**

- Type: `online`, `in-person`
- Status: `very-active`, `active`, `semi-active`, `inactive`
- Focus: `main-focus-is-ai-safety`, `partial-focus-on-ai-safety`
- Platforms: `discord`, `slack`, `facebook`, `forum`, `gather`, `reddit`, `telegram`, etc.

**Jobs filters:**

- Skills: `software-engineering`, `research`, `policy`, `operations`, `legal`, `finance`, `outreach`, `management`, `information-security`, `strategy`, `other`
- Experience: `entry-level`, `junior`, `mid`, `senior`, `multiple-experience-levels`
- Role type: `full-time`, `part-time`, `internship`, `fellowship`, `volunteering`, `funding`, `other`
- Work location: `on-site`, `remote`, `hybrid`

**Self-Study filters:**

- Category: `technical-alignment`, `introductory`, `governance`, `strategy`
- Type: `curriculum`, `reading-list`

**Funding filters:**

- Application status: `yes-rolling-basis`, `yes-deadline`, `no`, `unknown`
- Funding type: `fund`, `platform`, `grant-program`, `vc`, `incubator`, `fellowship`
- Recipient type: `any`, `researchers`, `nonprofits`, `individuals`, `startups`, `academics`

**Media Channels filters:**

- Type: `forum`, `youtube`, `podcast`, `newsletter`, `blog`, `book`, `twitter-list`, `article`

**Advisors filters:**

- Focus: `career-contribution`, `other`
- Status: `active`, `inactive`

**Projects filters:**

- Status: `active`, `seeking-owner`, `paused`

---

## Technical Considerations

### Airtable Integration

- Need to identify table IDs and view IDs for each data source
- Current pattern (from `/api/map`) works well:
  - Environment variables: `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`
  - Uses Next.js `revalidate` for 5-minute cache
  - Handles pagination for large datasets

### Mapbox Integration (for Communities page)

- Live site uses Mapbox GL JS for geographic community map
- Style ID: `cmh1t3h6u00e401st9gu75gvq`
- Account: `alignmentecosystemdevelopment`
- Will need: `MAPBOX_ACCESS_TOKEN` environment variable
- Dependencies: `mapbox-gl` or `react-map-gl`

### Performance Optimization

- Jobs page (500+ items) may need:
  - Server-side pagination
  - Optimized filtering
  - Virtual scrolling for large lists
- Consider React Query or SWR for client-side caching

### Mobile Responsiveness

- Current CSS has mobile breakpoints at 991px
- Database pages hide filter sidebar on mobile
- Consider mobile-first filter UI (modal/drawer)

### Styling Approach

- Using CSS variables from WebFlow
- Global styles in `globals.css` (1486 lines)
- Page-specific modules (e.g., `page.module.css`)
- Tailwind available but minimally used

---

## Recommended Implementation Order

1. **Phase 1: High Priority Database Pages**
   - Build reusable `FilterSidebar` component
   - Implement `/communities` (simpler, good template)
   - Implement `/self-study`
   - Implement `/jobs` (most complex)

2. **Phase 2: Medium Priority Pages**
   - Implement `/funding`
   - Implement `/media-channels`
   - Implement `/advisors`
   - Implement `/projects`

3. **Phase 3: Static Pages**
   - Implement `/donation-guide` (tab UI)
   - Implement `/about`
   - Implement `/feedback`

4. **Phase 4: Enhancements**
   - Replace Airtable embeds with native data
   - Add analytics integration
   - Performance optimization
   - SEO improvements

---

## Notes

### Navigation Updates Needed

The navigation component (`src/components/Navigation.tsx`) shows only 6 items with "+4" indicator. The live site shows all 10 pages are accessible. Consider:

- Adding dropdown/overflow menu for additional items
- Mobile navigation improvements

### URL Differences

- Live site uses `/funders` but code references `/funding`
- Ensure consistent URL structure

### Missing Assets

Some images referenced in the live site may need to be downloaded to `/public/images/`

---

## Contact

For questions about this migration, contact the AISafety.com team or check the project Discord.
