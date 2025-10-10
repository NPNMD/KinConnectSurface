# FamMedicalCare Design System

## Executive Summary

This design system establishes the visual language, interaction patterns, and implementation guidelines for FamMedicalCare—a family care coordination platform. The system bridges professional healthcare credibility with warm, family-centered design, embodying our brand values of trust, care, intelligence, collaboration, and empowerment.

**Design Philosophy:** Modern Healthcare Meets Warm Home  
**Core Principle:** Simplicity is Kindness

---

## Table of Contents

1. [Brand Foundation](#brand-foundation)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [UI Components](#ui-components)
6. [Iconography](#iconography)
7. [Elevation & Shadows](#elevation--shadows)
8. [Responsive Design](#responsive-design)
9. [Implementation](#implementation)
10. [Accessibility](#accessibility)

---

## Brand Foundation

### Design Principles

1. **Simplicity is Kindness**
   - Every feature reduces burden, not adds to it
   - Default to simple, offer advanced when needed
   - Clear is better than clever

2. **Anticipate Needs**
   - Proactive suggestions based on context
   - Smart defaults that save time
   - Gentle guidance at decision points

3. **Respect Emotional Context**
   - Acknowledge the stress of caregiving
   - Celebrate progress and effort
   - Provide calm during crisis

4. **Enable Collaboration**
   - Make sharing easy and secure
   - Facilitate communication
   - Recognize all contributions

5. **Build Trust Through Transparency**
   - Clear about data usage and privacy
   - Honest about capabilities
   - Consistent and reliable performance

### Visual Direction

**Calm Confidence** - Our aesthetic balances:
- Modern but Accessible
- Clean but Warm
- Professional but Friendly
- Organized but Flexible

---

## Color System

### Primary Palette

#### Trustworthy Blue (Primary Brand Color)
Our warm, approachable blue conveys reliability and medical credibility while remaining calming for stressed caregivers.

**Main Brand Blue**
- **Hex:** `#4A90E2`
- **RGB:** 74, 144, 226
- **Usage:** Primary logo, main CTAs, headers, trust elements
- **Tailwind:** `primary-500`

**Blue Scale:**
```
primary-50:  #EFF6FF  (Lightest backgrounds)
primary-100: #DBEAFE  (Subtle backgrounds)
primary-200: #BFDBFE  (Borders, dividers)
primary-300: #93C5FD  (Disabled states)
primary-400: #60A5FA  (Hover states)
primary-500: #4A90E2  (Primary brand)
primary-600: #2563EB  (Active states)
primary-700: #1D4ED8  (Dark text on light)
primary-800: #1E40AF  (Headers, emphasis)
primary-900: #1E3A8A  (Maximum contrast)
```

#### Nurturing Teal/Green (Secondary)
Bridges trust (blue) and health (green) with modern healthcare aesthetic.

**Main Teal**
- **Hex:** `#5DBEAA`
- **RGB:** 93, 190, 170
- **Usage:** Success states, health indicators, medication tracking
- **Tailwind:** `secondary-500`

**Teal Scale:**
```
secondary-50:  #F0FDFA
secondary-100: #CCFBF1
secondary-200: #99F6E4
secondary-300: #5EEAD4
secondary-400: #2DD4BF
secondary-500: #5DBEAA
secondary-600: #3A9B88
secondary-700: #0F766E
secondary-800: #115E59
secondary-900: #134E4A
```

#### Warm Coral (Accent)
Provides human warmth and energy without anxiety.

**Coral**
- **Hex:** `#FF8B7B`
- **RGB:** 255, 139, 123
- **Usage:** Important actions, notifications, warmth accents
- **Tailwind:** `accent-500`

**Coral Scale:**
```
accent-50:  #FFF5F3
accent-100: #FFE4E1
accent-200: #FFCDC7
accent-300: #FFB4A8
accent-400: #FF9D8F
accent-500: #FF8B7B
accent-600: #E67A6B
accent-700: #CC6A5C
accent-800: #B35A4D
accent-900: #994A3E
```

#### Soft Gold (Accent)
For achievements, premium features, and optimistic messaging.

**Gold**
- **Hex:** `#F4C542`
- **RGB:** 244, 197, 66
- **Usage:** Achievement highlights, premium features, optimism
- **Tailwind:** `gold-500`

### Neutral Palette

**Warm Grays** - Reduces visual stress while maintaining professionalism.

```
gray-50:  #FAFAFA  (Primary backgrounds)
gray-100: #F5F5F5  (Card backgrounds)
gray-200: #E5E5E5  (Borders, dividers)
gray-300: #D4D4D4  (Disabled text)
gray-400: #A3A3A3  (Placeholder text)
gray-500: #737373  (Secondary text)
gray-600: #525252  (Body text)
gray-700: #404040  (Emphasis text)
gray-800: #262626  (Headers)
gray-900: #171717  (Maximum contrast)
```

### Semantic Colors

#### Success (Green)
```
success-50:  #F0FDF4
success-500: #22C55E
success-700: #15803D
```

#### Warning (Yellow/Orange)
```
warning-50:  #FFFBEB
warning-500: #F59E0B
warning-700: #B45309
```

#### Error (Red)
```
error-50:  #FEF2F2
error-500: #EF4444
error-700: #B91C1C
```

#### Info (Blue)
```
info-50:  #EFF6FF
info-500: #3B82F6
info-700: #1D4ED8
```

### Color Usage Guidelines

**When to Use Each Color:**

- **Primary Blue:** Logo, navigation, primary CTAs, trust messaging, healthcare features
- **Secondary Teal:** Success confirmations, health/wellness features, medication tracking, positive progress
- **Accent Coral:** Important notifications (non-error), family connection features, warm moments
- **Accent Gold:** Achievements, premium features, milestones, encouragement
- **Neutrals:** Text hierarchy, backgrounds, borders, UI structure

**Color Combinations:**
- **Professional:** Primary Blue + Dark Blue + Warm Gray
- **Caring:** Primary Blue + Teal + Soft Peach
- **Energetic:** Coral + Gold + Light Blue
- **Calm:** Teal + Light Gray + Soft White
- **Trustworthy:** Dark Blue + Medium Gray + Pure White

### Accessibility Requirements

**WCAG 2.1 AA Compliance (4.5:1 minimum for normal text):**

✅ **Passing Combinations:**
- `gray-900` on `white`: 16.1:1
- `gray-800` on `white`: 12.6:1
- `gray-700` on `white`: 9.7:1
- `primary-700` on `white`: 7.2:1
- `secondary-700` on `white`: 6.8:1

⚠️ **Large Text Only (18pt+ or 14pt+ bold):**
- `primary-500` on `white`: 3.1:1
- `secondary-500` on `white`: 2.9:1

❌ **Avoid for Text:**
- Light colors (100-300) on white backgrounds
- Accent colors on white for body text

**Guidelines:**
1. Always use `gray-700` or darker for body text
2. Primary/Secondary colors acceptable for headings (18pt+)
3. Ensure 3:1 contrast minimum for UI components
4. Provide text alternatives for color-coded information
5. Test all combinations with contrast checker tools

---

## Typography

### Font Families

#### Primary: Inter (Humanist Sans-Serif)
Inter is our primary typeface—a humanist sans-serif that's friendly, clear, and accessible at all sizes.

**Why Inter:**
- Excellent readability at all sizes
- Warm personality without sacrificing professionalism
- Optimized for digital screens
- Extensive weight range for hierarchy
- Open source and widely available

**Fallback Stack:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 
             'Droid Sans', 'Helvetica Neue', sans-serif;
```

#### Alternative: System UI Stack
For maximum performance in specific contexts:
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

### Font Weights

```
Light:      300  (Sparingly, large display text only)
Regular:    400  (Body text, default)
Medium:     500  (Emphasis, labels)
Semibold:   600  (Subheadings, important UI)
Bold:       700  (Headings, strong emphasis)
Extrabold:  800  (Display headings only)
```

**Usage Guidelines:**
- **Body text:** Regular (400)
- **UI labels:** Medium (500)
- **Buttons:** Medium (500) or Semibold (600)
- **Subheadings:** Semibold (600)
- **Headings:** Bold (700)
- **Display:** Extrabold (800)

### Type Scale

Based on a 1.25 ratio (Major Third) for harmonious progression.

#### Display Headings

**Display XL (Hero)**
- **Size:** 60px / 3.75rem
- **Line Height:** 1.1 (66px)
- **Weight:** 800 (Extrabold)
- **Letter Spacing:** -0.02em
- **Usage:** Landing pages, hero sections
- **Tailwind:** `text-6xl font-extrabold`

**Display L**
- **Size:** 48px / 3rem
- **Line Height:** 1.15 (55px)
- **Weight:** 800 (Extrabold)
- **Letter Spacing:** -0.01em
- **Usage:** Major section headers
- **Tailwind:** `text-5xl font-extrabold`

#### Content Headings

**H1**
- **Size:** 36px / 2.25rem
- **Line Height:** 1.2 (43px)
- **Weight:** 700 (Bold)
- **Letter Spacing:** -0.01em
- **Usage:** Page titles
- **Tailwind:** `text-4xl font-bold`

**H2**
- **Size:** 30px / 1.875rem
- **Line Height:** 1.25 (38px)
- **Weight:** 700 (Bold)
- **Letter Spacing:** -0.005em
- **Usage:** Section headers
- **Tailwind:** `text-3xl font-bold`

**H3**
- **Size:** 24px / 1.5rem
- **Line Height:** 1.3 (31px)
- **Weight:** 600 (Semibold)
- **Letter Spacing:** 0
- **Usage:** Subsection headers
- **Tailwind:** `text-2xl font-semibold`

**H4**
- **Size:** 20px / 1.25rem
- **Line Height:** 1.4 (28px)
- **Weight:** 600 (Semibold)
- **Letter Spacing:** 0
- **Usage:** Card headers, component titles
- **Tailwind:** `text-xl font-semibold`

**H5**
- **Size:** 18px / 1.125rem
- **Line Height:** 1.4 (25px)
- **Weight:** 600 (Semibold)
- **Letter Spacing:** 0
- **Usage:** Small section headers
- **Tailwind:** `text-lg font-semibold`

**H6**
- **Size:** 16px / 1rem
- **Line Height:** 1.5 (24px)
- **Weight:** 600 (Semibold)
- **Letter Spacing:** 0
- **Usage:** List headers, minor sections
- **Tailwind:** `text-base font-semibold`

#### Body Text

**Body Large**
- **Size:** 18px / 1.125rem
- **Line Height:** 1.6 (29px)
- **Weight:** 400 (Regular)
- **Letter Spacing:** 0
- **Usage:** Introductory paragraphs, important content
- **Tailwind:** `text-lg`

**Body Regular (Base)**
- **Size:** 16px / 1rem
- **Line Height:** 1.5 (24px)
- **Weight:** 400 (Regular)
- **Letter Spacing:** 0
- **Usage:** Default body text, paragraphs
- **Tailwind:** `text-base`

**Body Small**
- **Size:** 14px / 0.875rem
- **Line Height:** 1.5 (21px)
- **Weight:** 400 (Regular)
- **Letter Spacing:** 0
- **Usage:** Secondary information, metadata
- **Tailwind:** `text-sm`

#### UI Elements

**Button Large**
- **Size:** 16px / 1rem
- **Line Height:** 1.5 (24px)
- **Weight:** 500 (Medium)
- **Letter Spacing:** 0.01em
- **Tailwind:** `text-base font-medium`

**Button Regular**
- **Size:** 14px / 0.875rem
- **Line Height:** 1.5 (21px)
- **Weight:** 500 (Medium)
- **Letter Spacing:** 0.01em
- **Tailwind:** `text-sm font-medium`

**Button Small**
- **Size:** 12px / 0.75rem
- **Line Height:** 1.5 (18px)
- **Weight:** 500 (Medium)
- **Letter Spacing:** 0.02em
- **Tailwind:** `text-xs font-medium`

**Label**
- **Size:** 14px / 0.875rem
- **Line Height:** 1.4 (20px)
- **Weight:** 500 (Medium)
- **Letter Spacing:** 0
- **Tailwind:** `text-sm font-medium`

**Caption**
- **Size:** 12px / 0.75rem
- **Line Height:** 1.4 (17px)
- **Weight:** 400 (Regular)
- **Letter Spacing:** 0.01em
- **Tailwind:** `text-xs`

**Overline**
- **Size:** 12px / 0.75rem
- **Line Height:** 1.4 (17px)
- **Weight:** 600 (Semibold)
- **Letter Spacing:** 0.08em
- **Text Transform:** Uppercase
- **Tailwind:** `text-xs font-semibold uppercase tracking-wider`

### Typography Accessibility

**Minimum Sizes:**
- Body text: Never below 14px (0.875rem)
- Interactive elements: Minimum 14px for touch targets
- Small text (12px): Only for non-essential metadata

**Line Height Guidelines:**
- Headings: 1.1 - 1.3 (tighter for impact)
- Body text: 1.5 - 1.6 (optimal readability)
- UI elements: 1.4 - 1.5 (balanced)

**Letter Spacing:**
- Large headings: Slightly negative (-0.02em to -0.01em)
- Body text: Normal (0)
- Small text: Slightly positive (0.01em to 0.02em)
- Uppercase: Increased (0.08em)

**Contrast Requirements:**
- Normal text (< 18px): 4.5:1 minimum
- Large text (≥ 18px or ≥ 14px bold): 3:1 minimum
- Always test with actual color combinations

---

## Spacing & Layout

### Base Unit System

**8px Grid System** - All spacing uses multiples of 8px for consistency and rhythm.

```
0:   0px    (none)
1:   4px    (0.25rem)  - Micro spacing
2:   8px    (0.5rem)   - Base unit
3:   12px   (0.75rem)  - Compact spacing
4:   16px   (1rem)     - Default spacing
5:   20px   (1.25rem)  - Comfortable spacing
6:   24px   (1.5rem)   - Section spacing
8:   32px   (2rem)     - Large spacing
10:  40px   (2.5rem)   - XL spacing
12:  48px   (3rem)     - XXL spacing
16:  64px   (4rem)     - Section breaks
20:  80px   (5rem)     - Major sections
24:  96px   (6rem)     - Page sections
32:  128px  (8rem)     - Hero spacing
```

### Spacing Scale Usage

**Component Internal Spacing:**
- **Micro (4px):** Icon-to-text, badge padding
- **Base (8px):** Button padding vertical, tight lists
- **Default (16px):** Button padding horizontal, card padding
- **Comfortable (24px):** Section padding, card spacing

**Layout Spacing:**
- **Section (32px):** Between major UI sections
- **Large (48px):** Between page sections
- **XL (64px):** Major section breaks
- **Hero (96px+):** Landing page sections

### Layout Margins & Padding

**Container Padding:**
```css
/* Mobile */
padding: 16px;  /* 1rem */

/* Tablet */
padding: 24px;  /* 1.5rem */

/* Desktop */
padding: 32px;  /* 2rem */
```

**Card Padding:**
```css
/* Compact */
padding: 12px;  /* 0.75rem */

/* Default */
padding: 16px;  /* 1rem */

/* Comfortable */
padding: 24px;  /* 1.5rem */

/* Spacious */
padding: 32px;  /* 2rem */
```

**Section Spacing:**
```css
/* Between components */
margin-bottom: 16px;  /* 1rem */

/* Between sections */
margin-bottom: 32px;  /* 2rem */

/* Between major sections */
margin-bottom: 48px;  /* 3rem */
```

### Component Spacing Rules

**Buttons:**
- Padding: `12px 16px` (vertical, horizontal)
- Gap between buttons: `8px` (horizontal), `12px` (vertical stack)
- Icon-to-text gap: `8px`

**Forms:**
- Label-to-input gap: `4px`
- Input-to-helper-text gap: `4px`
- Between form fields: `16px`
- Between form sections: `24px`

**Cards:**
- Internal padding: `16px` (mobile), `24px` (desktop)
- Gap between cards: `16px`
- Card-to-section gap: `24px`

**Lists:**
- List item padding: `12px 16px`
- Gap between list items: `0` (use borders)
- List-to-content gap: `16px`

**Navigation:**
- Nav item padding: `12px 16px`
- Gap between nav items: `4px`
- Nav-to-content gap: `0` (sticky header)

---

## UI Components

### Buttons

#### Primary Button
**Purpose:** Main call-to-action, primary user actions

**Visual Specs:**
- Background: `primary-600` (#2563EB)
- Text: `white`
- Font: Medium (500), 14px
- Padding: `12px 16px`
- Border Radius: `8px` (rounded-lg)
- Border: None

**States:**
```css
/* Default */
background: #2563EB;
color: white;

/* Hover */
background: #1D4ED8;  /* primary-700 */

/* Active/Pressed */
background: #1E40AF;  /* primary-800 */
transform: scale(0.98);

/* Focus */
outline: 2px solid #3B82F6;  /* primary-500 */
outline-offset: 2px;

/* Disabled */
background: #93C5FD;  /* primary-300 */
color: white;
opacity: 0.6;
cursor: not-allowed;

/* Loading */
background: #2563EB;
opacity: 0.8;
cursor: wait;
```

**Tailwind Classes:**
```html
<button class="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 
               text-white font-medium py-3 px-4 rounded-lg 
               transition-colors duration-200 
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
               disabled:opacity-60 disabled:cursor-not-allowed">
  Primary Action
</button>
```

#### Secondary Button
**Purpose:** Secondary actions, alternative options

**Visual Specs:**
- Background: `gray-200` (#E5E5E5)
- Text: `gray-900` (#171717)
- Font: Medium (500), 14px
- Padding: `12px 16px`
- Border Radius: `8px`
- Border: None

**States:**
```css
/* Default */
background: #E5E5E5;
color: #171717;

/* Hover */
background: #D4D4D4;  /* gray-300 */

/* Active */
background: #A3A3A3;  /* gray-400 */

/* Focus */
outline: 2px solid #737373;  /* gray-500 */
outline-offset: 2px;

/* Disabled */
background: #F5F5F5;  /* gray-100 */
color: #A3A3A3;  /* gray-400 */
opacity: 0.6;
```

**Tailwind Classes:**
```html
<button class="bg-gray-200 hover:bg-gray-300 active:bg-gray-400
               text-gray-900 font-medium py-3 px-4 rounded-lg
               transition-colors duration-200
               focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
               disabled:opacity-60 disabled:cursor-not-allowed">
  Secondary Action
</button>
```

#### Tertiary/Ghost Button
**Purpose:** Low-emphasis actions, navigation

**Visual Specs:**
- Background: Transparent
- Text: `primary-600`
- Font: Medium (500), 14px
- Padding: `12px 16px`
- Border Radius: `8px`
- Border: None

**States:**
```css
/* Default */
background: transparent;
color: #2563EB;

/* Hover */
background: #EFF6FF;  /* primary-50 */

/* Active */
background: #DBEAFE;  /* primary-100 */

/* Focus */
outline: 2px solid #3B82F6;
outline-offset: 2px;
```

**Tailwind Classes:**
```html
<button class="bg-transparent hover:bg-primary-50 active:bg-primary-100
               text-primary-600 font-medium py-3 px-4 rounded-lg
               transition-colors duration-200
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
  Tertiary Action
</button>
```

#### Danger Button
**Purpose:** Destructive actions, deletions

**Visual Specs:**
- Background: `error-600` (#DC2626)
- Text: `white`
- Font: Medium (500), 14px
- Padding: `12px 16px`
- Border Radius: `8px`

**Tailwind Classes:**
```html
<button class="bg-red-600 hover:bg-red-700 active:bg-red-800
               text-white font-medium py-3 px-4 rounded-lg
               transition-colors duration-200
               focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
  Delete
</button>
```

#### Button Sizes

**Large:**
- Padding: `14px 20px`
- Font: 16px
- Min Height: 48px
- Tailwind: `py-3.5 px-5 text-base`

**Regular (Default):**
- Padding: `12px 16px`
- Font: 14px
- Min Height: 44px
- Tailwind: `py-3 px-4 text-sm`

**Small:**
- Padding: `8px 12px`
- Font: 12px
- Min Height: 36px
- Tailwind: `py-2 px-3 text-xs`

**Icon Button:**
- Padding: `12px` (square)
- Size: 44x44px minimum
- Tailwind: `p-3`

#### Button with Icon

**Icon Left:**
```html
<button class="btn-primary flex items-center space-x-2">
  <Icon className="w-4 h-4" />
  <span>Action</span>
</button>
```

**Icon Right:**
```html
<button class="btn-primary flex items-center space-x-2">
  <span>Action</span>
  <Icon className="w-4 h-4" />
</button>
```

**Icon Only:**
```html
<button class="btn-primary p-3" aria-label="Action description">
  <Icon className="w-5 h-5" />
</button>
```

### Form Inputs

#### Text Input
**Purpose:** Single-line text entry

**Visual Specs:**
- Background: `white`
- Border: 1px solid `gray-300`
- Text: `gray-900`, 16px
- Padding: `12px 16px`
- Border Radius: `8px`
- Min Height: 44px

**States:**
```css
/* Default */
background: white;
border: 1px solid #D4D4D4;  /* gray-300 */
color: #171717;  /* gray-900 */

/* Focus */
border-color: #2563EB;  /* primary-600 */
outline: 2px solid #3B82F6;  /* primary-500 */
outline-offset: 0;

/* Error */
border-color: #DC2626;  /* error-600 */
outline: 2px solid #EF4444;  /* error-500 */

/* Disabled */
background: #F5F5F5;  /* gray-100 */
border-color: #E5E5E5;  /* gray-200 */
color: #A3A3A3;  /* gray-400 */
cursor: not-allowed;

/* Read-only */
background: #FAFAFA;  /* gray-50 */
border-color: #E5E5E5;
```

**Tailwind Classes:**
```html
<input type="text" 
       class="w-full px-4 py-3 border border-gray-300 rounded-lg
              text-gray-900 placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-600
              disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
              transition-colors duration-200"
       placeholder="Enter text...">
```

#### Text Area
**Purpose:** Multi-line text entry

**Visual Specs:**
- Same as text input
- Min Height: 96px (6 lines)
- Resize: Vertical only

**Tailwind Classes:**
```html
<textarea class="w-full px-4 py-3 border border-gray-300 rounded-lg
                 text-gray-900 placeholder-gray-400
                 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-600
                 resize-y min-h-[96px]"
          placeholder="Enter description..."></textarea>
```

#### Select Dropdown
**Purpose:** Single selection from list

**Visual Specs:**
- Same as text input
- Icon: Chevron down, `gray-400`
- Icon size: 20px

**Tailwind Classes:**
```html
<select class="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg
               text-gray-900 bg-white
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-600
               appearance-none bg-[url('data:image/svg+xml...')]">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

#### Checkbox
**Purpose:** Multiple selections, toggles

**Visual Specs:**
- Size: 20x20px
- Border: 2px solid `gray-300`
- Border Radius: `4px`
- Checkmark: `white` on `primary-600`

**States:**
```css
/* Unchecked */
background: white;
border: 2px solid #D4D4D4;

/* Checked */
background: #2563EB;
border: 2px solid #2563EB;

/* Focus */
outline: 2px solid #3B82F6;
outline-offset: 2px;

/* Disabled */
background: #F5F5F5;
border-color: #E5E5E5;
opacity: 0.6;
```

**Tailwind Classes:**
```html
<label class="flex items-center space-x-2 cursor-pointer">
  <input type="checkbox" 
         class="w-5 h-5 text-primary-600 border-gray-300 rounded
                focus:ring-2 focus:ring-primary-500
                disabled:opacity-60 disabled:cursor-not-allowed">
  <span class="text-sm text-gray-700">Checkbox label</span>
</label>
```

#### Radio Button
**Purpose:** Single selection from group

**Visual Specs:**
- Size: 20x20px
- Border: 2px solid `gray-300`
- Border Radius: `50%` (circle)
- Dot: `primary-600`, 10px diameter

**Tailwind Classes:**
```html
<label class="flex items-center space-x-2 cursor-pointer">
  <input type="radio" 
         class="w-5 h-5 text-primary-600 border-gray-300
                focus:ring-2 focus:ring-primary-500
                disabled:opacity-60 disabled:cursor-not-allowed">
  <span class="text-sm text-gray-700">Radio option</span>
</label>
```

#### Toggle Switch
**Purpose:** Binary on/off states

**Visual Specs:**
- Width: 44px
- Height: 24px
- Border Radius: `12px` (pill)
- Knob: 20px diameter, `white`

**States:**
```css
/* Off */
background: #D4D4D4;  /* gray-300 */
knob-position: left;

/* On */
background: #2563EB;  /* primary-600 */
knob-position: right;

/* Focus */
outline: 2px solid #3B82F6;
outline-offset: 2px;
```

**Tailwind Classes:**
```html
<button type="button" 
        class="relative inline-flex h-6 w-11 items-center rounded-full
               bg-gray-300 transition-colors
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
               data-[checked]:bg-primary-600">
  <span class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform
               translate-x-0.5 data-[checked]:translate-x-6"></span>
</button>
```

#### Form Field Structure

**Complete Form Field:**
```html
<div class="space-y-1">
  <!-- Label -->
  <label for="field-id" class="block text-sm font-medium text-gray-700">
    Field Label
    <span class="text-red-500">*</span> <!-- Required indicator -->
  </label>
  
  <!-- Input -->
  <input id="field-id" 
         type="text"
         class="w-full px-4 py-3 border border-gray-300 rounded-lg
                focus:ring-2 focus:ring-primary-500 focus:border-primary-600"
         aria-describedby="field-help field-error">
  
  <!-- Helper Text -->
  <p id="field-help" class="text-xs text-gray-500">
    Optional helper text
  </p>
  
  <!-- Error Message -->
  <p id="field-error" class="text-xs text-red-600 flex items-center space-x-1">
    <AlertCircle className="w-3 h-3" />
    <span>Error message here</span>
  </p>
</div>
```

### Cards

#### Basic Card
**Purpose:** Content containers, grouping related information

**Visual Specs:**
- Background: `white`
- Border: 1px solid `gray-200`
- Border Radius: `12px` (rounded-xl)
- Padding: `24px` (desktop), `16px` (mobile)
- Shadow: `shadow-sm` (subtle)

**Tailwind Classes:**
```html
<div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
  <!-- Card content -->
</div>
```

#### Interactive Card
**Purpose:** Clickable cards, navigation

**States:**
```css
/* Default */
background: white;
border: 1px solid #E5E5E5;
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

/* Hover */
border-color: #2563EB;  /* primary-600 */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
transform: translateY(-2px);

/* Active */
transform: translateY(0);
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
```

**Tailwind Classes:**
```html
<button class="w-full bg-white rounded-xl border border-gray-200 p-6 shadow-sm
               hover:border-primary-600 hover:shadow-md hover:-translate-y-0.5
               active:translate-y-0 active:shadow-sm
               transition-all duration-200 text-left">
  <!-- Card content -->
</button>
```

#### Status Cards
**Purpose:** Highlight different states or categories

**Success Card:**
```html
<div class="bg-green-50 border border-green-200 rounded-xl p-6">
  <!-- Success content -->
</div>
```

**Warning Card:**
```html
<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
  <!-- Warning content -->
</div>
```

**Error Card:**
```html
<div class="bg-red-50 border border-red-200 rounded-xl p-6">
  <!-- Error content -->
</div>
```

**Info Card:**
```html
<div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
  <!-- Info content -->
</div>
```

### Navigation

#### Mobile Bottom Navigation
**Purpose:** Primary navigation on mobile devices

**Visual Specs:**
- Background: `white`
- Border Top: 1px solid `gray-200`
- Height: Auto (with safe area)
- Padding: `8px 16px` + safe area
- Shadow: `0 -2px 10px rgba(0, 0, 0, 0.1)`
- Position: Fixed bottom
- Z-index: 9999

**Nav Item:**
- Padding: `8px`
- Icon Size: 20px
- Text: 12px, Medium (500)
- Gap: 4px (icon to text)

**States:**
```css
/* Inactive */
color: #A3A3A3;  /* gray-400 */

/* Active */
color: #2563EB;  /* primary-600 */
background: #EFF6FF;  /* primary-50 */
border-radius: 8px;

/* Hover */
color: #525252;  /* gray-600 */
```

**Tailwind Classes:**
```html
<nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 
            z-[9999] px-4 py-2 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
  <div class="flex items-center justify-between">
    <button class="flex-1 flex flex-col items-center space-y-1 p-2
                   text-gray-400 hover:text-gray-600
                   data-[active]:text-primary-600 data-[active]:bg-primary-50
                   rounded-lg transition-colors">
      <Icon className="w-5 h-5" />
      <span class="text-xs font-medium">Home</span>
    </button>
    <!-- More nav items -->
  </div>
</nav>
```

#### Desktop Header Navigation
**Purpose:** Primary navigation on desktop

**Visual Specs:**
- Background: `white`
- Border Bottom: 1px solid `gray-200`
- Height: 64px
- Padding: `0 32px`
- Shadow: `shadow-sm`
- Position: Sticky top

**Tailwind Classes:**
```html
<header class="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
  <div class="flex items-center justify-between h-16 px-8">
    <!-- Logo -->
    <div class="flex items-center space-x-2">
      <Logo className="w-6 h-6 text-primary-600" />
      <span class="text-lg font-bold text-gray-900">FamMedicalCare</span>
    </div>
    
    <!-- Nav Items -->
    <nav class="flex items-center space-x-1">
      <a href="#" class="px-4 py-2 text-sm font-medium text-gray-700
                         hover:text-gray-900 hover:bg-gray-100
                         rounded-lg transition-colors">
        Link
      </a>
    </nav>
  </div>
</header>
```

### Alerts & Notifications

#### Alert Banner
**Purpose:** System messages, important information

**Visual Specs:**
- Border Radius: `8px`
- Padding: `16px`
- Icon Size: 20px
- Icon-to-text gap: 12px

**Success Alert:**
```html
<div class="bg-green-50 border border-green-200 rounded-lg p-4">
  <div class="flex items-start space-x-3">
    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
    <div class="flex-1">
      <h4 class="text-sm font-medium text-green-900">Success</h4>
      <p class="text-sm text-green-700 mt-1">Your changes have been saved.</p>
    </div>
  </div>
</div>
```

**Warning Alert:**
```html
<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
  <div class="flex items-start space-x-3">
    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
    <div class="flex-1">
      <h4 class="text-sm font-medium text-yellow-900">Warning</h4>
      <p class="text-sm text-yellow-700 mt-1">Please review before proceeding.</p>
    </div>
  </div>
</div>
```

**Error Alert:**
```html
<div class="bg-red-50 border border-red-200 rounded-lg p-4">
  <div class="flex items-start space-x-3">
    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
    <div class="flex-1">
      <h4 class="text-sm font-medium text-red-900">Error</h4>
      <p class="text-sm text-red-700 mt-1">Something went wrong. Please try again.</p>
    </div>
  </div>
</div>
```

**Info Alert:**
```html
<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <div class="flex items-start space-x-3">
    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
    <div class="flex-1">
      <h4 class="text-sm font-medium text-blue-900">Information</h4>
      <p class="text-sm text-blue-700 mt-1">Here's some helpful information.</p>
    </div>
  </div>
</div>
```

#### Toast Notification
**Purpose:** Temporary feedback messages

**Visual Specs:**
- Background: `white`
- Border: 1px solid `gray-200`
- Border Radius: `8px`
- Padding: `16px`
- Shadow: `shadow-lg`
- Max Width: 400px
- Position: Fixed (top-right or bottom-right)
- Animation: Slide in from right, fade out

**Tailwind Classes:**
```html
<div class="fixed top-4 right-4 z-50 max-w-md
            bg-white border border-gray-200 rounded-lg p-4 shadow-lg
            animate-slide-in-right">
  <div class="flex items-start space-x-3">
    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
    <div class="flex-1">
      <p class="text-sm font-medium text-gray-900">Success</p>
      <p class="text-sm text-gray-600 mt-1">Action completed successfully.</p>
    </div>
    <button class="text-gray-400 hover:text-gray-600">
      <X className="w-4 h-4" />
    </button>
  </div>
</div>
```

### Modals & Dialogs

#### Modal Dialog
**Purpose:** Focus user attention, require interaction

**Visual Specs:**
- Backdrop: `rgba(0, 0, 0, 0.5)`
- Background: `white`
- Border Radius: `12px`
- Max Width: 600px (desktop), 90vw (mobile)
- Padding: `24px`
- Shadow: `shadow-2xl`

**Tailwind Classes:**
```html
<!-- Backdrop -->
<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
  <!-- Modal -->
  <div class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-200">
      <h3 class="text-xl font-semibold text-gray-900">Modal Title</h3>
      <button class="text-gray-400 hover:text-gray-600">
        <X className="w-5 h-5" />
      </button>
    </div>
    
    <!-- Body -->
    <div class="p-6">
      <!-- Modal content -->
    </div>
    
    <!-- Footer -->
    <div class="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
      <button class="btn-secondary">Cancel</button>
      <button class="btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

#### Confirmation Dialog
**Purpose:** Confirm destructive actions

**Tailwind Classes:**
```html
<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
    <div class="flex items-start space-x-4">
      <div class="flex-shrink-0 p-3 bg-red-100 rounded-full">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">
          Confirm Deletion
        </h3>
        <p class="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this item? This action cannot be undone.
        </p>
        <div class="flex items-center justify-end space-x-3">
          <button class="btn-secondary">Cancel</button>
          <button class="btn-danger">Delete</button>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Loading States

#### Spinner
**Purpose:** Indicate loading/processing

**Sizes:**
- Small: 16px
- Medium: 24px
- Large: 32px
- XL: 48px

**Tailwind Classes:**
```html
<!-- Small -->
<div class="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>

<!-- Medium -->
<div class="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>

<!-- Large -->
<div class="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
```

#### Skeleton Loader
**Purpose:** Content placeholder while loading

**Tailwind Classes:**
```html
<div class="animate-pulse space-y-4">
  <!-- Text line -->
  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
  <div class="h-4 bg-gray-200 rounded w-1/2"></div>
  
  <!-- Card -->
  <div class="bg-gray-200 rounded-lg h-32"></div>
</div>
```

#### Progress Bar
**Purpose:** Show completion progress

**Tailwind Classes:**
```html
<div class="w-full bg-gray-200 rounded-full h-2">
  <div class="bg-primary-600 h-2 rounded-full transition-all duration-300" 
       style="width: 60%"></div>
</div>
```

---

## Iconography

### Icon System

**Library:** Lucide React (currently in use)
- Consistent stroke weight
- Outline style (not filled)
- Optimized for web
- Extensive icon set
- React components

**Alternative:** Heroicons (recommended for future)
- Designed by Tailwind team
- Perfect alignment with Tailwind
- Outline and solid variants
- Excellent accessibility

### Icon Sizes

```
xs:  12px  (0.75rem)  - Inline with small text
sm:  16px  (1rem)     - Inline with body text
md:  20px  (1.25rem)  - Default UI icons
lg:  24px  (1.5rem)   - Prominent icons
xl:  32px  (2rem)     - Feature icons
2xl: 48px  (3rem)     - Hero icons
```

**Tailwind Classes:**
```html
<Icon className="w-3 h-3" />  <!-- 12px -->
<Icon className="w-4 h-4" />  <!-- 16px -->
<Icon className="w-5 h-5" />  <!-- 20px -->
<Icon className="w-6 h-6" />  <!-- 24px -->
<Icon className="w-8 h-8" />  <!-- 32px -->
<Icon className="w-12 h-12" /> <!-- 48px -->
```

### Icon Colors

**Semantic Colors:**
```html
<!-- Primary action -->
<Icon className="w-5 h-5 text-primary-600" />

<!-- Success -->
<Icon className="w-5 h-5 text-green-600" />

<!-- Warning -->
<Icon className="w-5 h-5 text-yellow-600" />

<!-- Error -->
<Icon className="w-5 h-5 text-red-600" />

<!-- Info -->
<Icon className="w-5 h-5 text-blue-600" />

<!-- Neutral/Inactive -->
<Icon className="w-5 h-5 text-gray-400" />

<!-- Active/Emphasis -->
<Icon className="w-5 h-5 text-gray-700" />
```

### Icon Usage Guidelines

**With Text:**
- Icon size should match text size
- Use 8px gap between icon and text
- Align icon vertically with text

```html
<div class="flex items-center space-x-2">
  <Icon className="w-4 h-4 text-gray-600" />
  <span class="text-sm text-gray-700">Text label</span>
</div>
```

**In Buttons:**
- Use 16px (sm) or 20px (md) icons
- 8px gap from text
- Align center vertically

```html
<button class="btn-primary flex items-center space-x-2">
  <Icon className="w-4 h-4" />
  <span>Button Text</span>
</button>
```

**Icon-Only Buttons:**
- Minimum 44x44px touch target
- Include aria-label for accessibility
- Use tooltip for clarity

```html
<button class="p-3 hover:bg-gray-100 rounded-lg" 
        aria-label="Settings">
  <Settings className="w-5 h-5 text-gray-600" />
</button>
```

### Common Icon Mappings

**Navigation:**
- Home: `Heart` (brand-specific)
- Medications: `Pill`
- Calendar: `Calendar`
- Profile: `User`
- Family: `Users`
- Settings: `Settings`

**Actions:**
- Add: `Plus`
- Edit: `Pencil` or `Edit`
- Delete: `Trash2`
- Save: `Check` or `Save`
- Cancel: `X`
- Search: `Search`
- Filter: `Filter`
- Sort: `ArrowUpDown`

**Status:**
- Success: `CheckCircle`
- Warning: `AlertTriangle`
- Error: `AlertCircle`
- Info: `Info`
- Loading: `Loader` (spinning)

**Medical:**
- Medication: `Pill`
- Appointment: `Calendar` or `Stethoscope`
- Doctor: `Stethoscope`
- Hospital: `Building`
- Lab: `Activity`
- Prescription: `FileText`

---

## Elevation & Shadows

### Shadow System

**Philosophy:** Subtle elevation that doesn't distract. Shadows should suggest depth, not dominate the interface.

**Shadow Levels:**

**Level 0 - None**
```css
box-shadow: none;
```
**Usage:** Flat elements, inline content
**Tailwind:** `shadow-none`

**Level 1 - Subtle**
```css
box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
```
**Usage:** Cards, containers, subtle elevation
**Tailwind:** `shadow-sm`

**Level 2 - Default**
```css
box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 
            0 1px 2px -1px rgba(0, 0, 0, 0.1);
```
**Usage:** Raised cards, dropdowns
**Tailwind:** `shadow`

**Level 3 - Medium**
```css
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
            0 2px 4px -2px rgba(0, 0, 0, 0.1);
```
**Usage:** Hover states, floating elements
**Tailwind:** `shadow-md`

**Level 4 - Large**
```css
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 
            0 4px 6px -4px rgba(0, 0, 0, 0.1);
```
**Usage:** Modals, popovers, important overlays
**Tailwind:** `shadow-lg`

**Level 5 - Extra Large**
```css
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 
            0 8px 10px -6px rgba(0, 0, 0, 0.1);
```
**Usage:** Major modals, dialogs
**Tailwind:** `shadow-xl`

**Level 6 - 2XL**
```css
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```
**Usage:** Maximum elevation, critical dialogs
**Tailwind:** `shadow-2xl`

### Border Radius

**Radius Scale:**

```
none:   0px      - Sharp corners (rare)
sm:     4px      - Subtle rounding
DEFAULT: 8px     - Standard rounding
md:     8px      - Same as default
lg:     12px     - Cards, containers
xl:     16px     - Large cards
2xl:    20px     - Hero sections
3xl:    24px     - Maximum rounding
full:   9999px   - Pills, circles
```

**Usage Guidelines:**

- **Buttons:** `rounded-lg` (12px)
- **Inputs:** `rounded-lg` (12px)
- **Cards:** `rounded-xl` (16px)
- **Modals:** `rounded-xl` (16px)
- **Badges:** `rounded-full` (pill)
- **Avatars:** `rounded-full` (circle)
- **Images:** `rounded-lg` (12px)

### Elevation Usage

**When to Use Each Level:**

**Level 0 (None):**
- Inline elements
- Text content
- Flat backgrounds

**Level 1 (Subtle):**
- Default cards
- List items
- Subtle containers

**Level 2 (Default):**
- Interactive cards
- Dropdown menus
- Tooltips

**Level 3 (Medium):**
- Hover states on cards
- Floating action buttons
- Active dropdowns

**Level 4 (Large):**
- Modals
- Popovers
- Slide-out panels

**Level 5 (XL):**
- Critical modals
- Full-screen overlays
- Important dialogs

**Level 6 (2XL):**
- Maximum emphasis
- Confirmation dialogs
- Error modals

---

## Responsive Design

### Breakpoints

**Mobile-First Approach** - Design for mobile, enhance for larger screens.

```css
/* Tailwind Breakpoints */
sm:  640px   /* Small tablets, large phones */
md:  768px   /* Tablets */
lg:  1024px  /* Small laptops */
xl:  1280px  /* Desktops */
2xl: 1536px  /* Large desktops */
```

**Usage:**
```html
<!-- Mobile: stack, Desktop: side-by-side -->
<div class="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
  <!-- Content -->
</div>
```

### Layout Grid

**Container Widths:**
```css
/* Mobile */
max-width: 100%;
padding: 16px;

/* Tablet (md) */
max-width: 768px;
padding: 24px;

/* Desktop (lg) */
max-width: 1024px;
padding: 32px;

/* Large Desktop (xl) */
max-width: 1280px;
padding: 32px;
```

**Tailwind Classes:**
```html
<div class="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
  <!-- Content -->
</div>
```

### Grid System

**12-Column Grid:**
```html
<!-- 2 columns on mobile, 3 on tablet, 4 on desktop -->
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  <div>Column</div>
  <div>Column</div>
  <div>Column</div>
  <div>Column</div>
</div>
```

**Common Layouts:**

**Sidebar Layout:**
```html
<div class="flex flex-col lg:flex-row gap-6">
  <!-- Sidebar: full width on mobile, 1/4 on desktop -->
  <aside class="w-full lg:w-1/4">Sidebar</aside>
  
  <!-- Main: full width on mobile, 3/4 on desktop -->
  <main class="w-full lg:w-3/4">Main Content</main>
</div>
```

**Card Grid:**
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
  <div class="card">Card 4</div>
</div>
```

### Component Responsive Behavior

**Typography:**
```html
<!-- Responsive heading -->
<h1 class="text-2xl md:text-3xl lg:text-4xl font-bold">
  Responsive Heading
</h1>

<!-- Responsive body text -->
<p class="text-sm md:text-base lg:text-lg">
  Responsive paragraph
</p>
```

**Spacing:**
```html
<!-- Responsive padding -->
<div class="p-4 md:p-6 lg:p-8">Content</div>

<!-- Responsive margin -->
<div class="mb-4 md:mb-6 lg:mb-8">Content</div>

<!-- Responsive gap -->
<div class="flex gap-2 md:gap-4 lg:gap-6">Items</div>
```

**Buttons:**
```html
<!-- Full width on mobile, auto on desktop -->
<button class="w-full md:w-auto btn-primary">
  Responsive Button
</button>
```

**Navigation:**
```html
<!-- Mobile: bottom nav, Desktop: top nav -->
<nav class="block md:hidden">Mobile Nav</nav>
<nav class="hidden md:block">Desktop Nav</nav>
```

### Mobile-Specific Considerations

**Touch Targets:**
- Minimum 44x44px for all interactive elements
- Use `touch-target` utility class
- Increase padding on mobile

**Safe Areas:**
```css
/* iOS safe area support */
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

**Tailwind Classes:**
```html
<div class="pb-safe">Content with safe area</div>
```

**Mobile Navigation:**
- Fixed bottom navigation on mobile
- Sticky top navigation on desktop
- Hamburger menu for complex navigation

**Performance:**
- Lazy load images on mobile
- Reduce animation complexity
- Optimize for slower connections

---

## Implementation

### CSS Custom Properties

**Color Variables:**
```css
:root {
  /* Primary */
  --color-primary-50: #EFF6FF;
  --color-primary-500: #4A90E2;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;
  
  /* Secondary */
  --color-secondary-500: #5DBEAA;
  --color-secondary-600: #3A9B88;
  
  /* Accent */
  --color-accent-500: #FF8B7B;
  --color-gold-500: #F4C542;
  
  /* Neutrals */
  --color-gray-50: #FAFAFA;
  --color-gray-200: #E5E5E5;
  --color-gray-400: #A3A3A3;
  --color-gray-600: #525252;
  --color-gray-900: #171717;
  
  /* Semantic */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
}
```

**Spacing Variables:**
```css
:root {
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-12: 48px;
  --spacing-16: 64px;
}
```

**Typography Variables:**
```css
:root {
  --font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 1.875rem;  /* 30px */
  --font-size-4xl: 2.25rem;   /* 36px */
  
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

### Tailwind Configuration

**Complete tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#4A90E2',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        secondary: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#5DBEAA',
          600: '#3A9B88',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        accent: {
          50: '#FFF5F3',
          100: '#FFE4E1',
          200: '#FFCDC7',
          300: '#FFB4A8',
          400: '#FF9D8F',
          500: '#FF8B7B',
          600: '#E67A6B',
          700: '#CC6A5C',
          800: '#B35A4D',
          900: '#994A3E',
        },
        gold: {
          500: '#F4C542',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe': 'env(safe-area-inset-bottom)',
      },
      borderRadius: {
        'DEFAULT': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
}
```

### Component Class Patterns

**Button Classes:**
```css
/* In index.css */
@layer components {
  .btn-primary {
    @apply bg-primary-600 hover:bg-primary-700 active:bg-primary-800
           text-white font-medium py-3 px-4 rounded-lg
           transition-colors duration-200
           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
           disabled:opacity-60 disabled:cursor-not-allowed;
  }
  
  .btn-secondary {
    @apply bg-gray-200 hover:bg-gray-300 active:bg-gray-400
           text-gray-900 font-medium py-3 px-4 rounded-lg
           transition-colors duration-200
           focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
           disabled:opacity-60 disabled:cursor-not-allowed;
  }
  
  .btn-danger {
    @apply bg-red-600 hover:bg-red-700 active:bg-red-800
           text-white font-medium py-3 px-4 rounded-lg
           transition-colors duration-200
           focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
           disabled:opacity-60 disabled:cursor-not-allowed;
  }
}
```

**Form Classes:**
```css
@layer components {
  .input {
    @apply w-full px-4 py-3 border border-gray-300 rounded-lg
           text-gray-900 placeholder-gray-400
           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-600
           disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
           transition-colors duration-200;
  }
  
  .label {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }
  
  .input-error {
    @apply border-red-300 focus:ring-red-500 focus:border-red-600;
  }
}
```

**Card Classes:**
```css
@layer components {
  .card {
    @apply bg-white rounded-xl border border-gray-200 p-6 shadow-sm;
  }
  
  .card-interactive {
    @apply card hover:border-primary-600 hover:shadow-md hover:-translate-y-0.5
           active:translate-y-0 active:shadow-sm
           transition-all duration-200 cursor-pointer;
  }
}
```

### Naming Conventions

**Component Naming:**
- Use PascalCase for React components: `ButtonPrimary`, `CardInteractive`
- Use kebab-case for CSS classes: `btn-primary`, `card-interactive`
- Use camelCase for JavaScript variables: `isLoading`, `handleClick`

**File Naming:**
- Components: `ComponentName.tsx`
- Utilities: `utilityName.ts`
- Styles: `componentName.css` or use Tailwind

**Class Naming:**
- Base: `.component-name`
- Modifier: `.component-name--modifier`
- State: `.component-name.is-active`
- Utility: `.u-utility-name`

**BEM Alternative (Tailwind-friendly):**
- Use Tailwind utilities primarily
- Create component classes for repeated patterns
- Use data attributes for state: `data-active="true"`

### Performance Optimization

**CSS:**
- Use Tailwind's JIT mode for minimal CSS
- Purge unused styles in production
- Minimize custom CSS

**Images:**
- Use WebP format with fallbacks
- Implement lazy loading
- Optimize image sizes for different breakpoints

**Fonts:**
- Use `font-display: swap` for web fonts
- Subset fonts to include only needed characters
- Preload critical fonts

**JavaScript:**
- Code split by route
- Lazy load non-critical components
- Minimize bundle size

---

## Accessibility

### WCAG 2.1 AA Compliance

**Color Contrast:**
- Normal text: 4.5:1 minimum
- Large text (18pt+ or 14pt+ bold): 3:1 minimum
- UI components: 3:1 minimum
- Always test with contrast checker

**Keyboard Navigation:**
- All interactive elements must be keyboard accessible
- Visible focus indicators required
- Logical tab order
- Skip links for main content

**Screen Readers:**
- Semantic HTML elements
- ARIA labels where needed
- Alt text for images
- Descriptive link text

### Focus Management

**Focus Indicators:**
```css
/* Default focus ring */
.focus-visible:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Custom focus for buttons */
.btn:focus-visible {
  @apply ring-2 ring-primary-500 ring-offset-2;
}
```

**Focus Trap:**
- Trap focus within modals
- Return focus after modal closes
- Manage focus for dynamic content

### ARIA Patterns

**Buttons:**
```html
<button aria-label="Close dialog">
  <X className="w-5 h-5" />
</button>
```

**Form Fields:**
```html
<input 
  id="email"
  type="email"
  aria-describedby="email-help email-error"
  aria-invalid="true"
  aria-required="true"
>
<p id="email-help">Enter your email address</p>
<p id="email-error" role="alert">Invalid email format</p>
```

**Navigation:**
```html
<nav aria-label="Main navigation">
  <ul role="list">
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

**Modals:**
```html
<div role="dialog" 
     aria-modal="true" 
     aria-labelledby="modal-title"
     aria-describedby="modal-description">
  <h2 id="modal-title">Modal Title</h2>
  <p id="modal-description">Modal description</p>
</div>
```

### Touch Targets

**Minimum Sizes:**
- Touch targets: 44x44px minimum
- Spacing between targets: 8px minimum
- Increase padding on mobile devices

**Implementation:**
```css
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
```

### Motion & Animation

**Respect User Preferences:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Tailwind:**
```html
<div class="transition-transform motion-reduce:transition-none">
  Animated content
</div>
```

### Testing Checklist

- [ ] Color contrast meets WCAG AA standards
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible and clear
- [ ] Screen reader announces content correctly
- [ ] Forms have proper labels and error messages
- [ ] Images have alt text
- [ ] Headings follow logical hierarchy
- [ ] Touch targets meet minimum size
- [ ] Respects reduced motion preferences
- [ ] Works without JavaScript (progressive enhancement)

---

## Design Tokens Summary

### Quick Reference

**Colors:**
- Primary: `#4A90E2` (Trustworthy Blue)
- Secondary: `#5DBEAA` (Nurturing Teal)
- Accent: `#FF8B7B` (Warm Coral)
- Success: `#22C55E`
- Warning: `#F59E0B`
- Error: `#EF4444`

**Typography:**
- Font: Inter
- Base Size: 16px
- Scale: 1.25 ratio
- Line Height: 1.5 (body), 1.2 (headings)

**Spacing:**
- Base Unit: 8px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px

**Borders:**
- Radius: 8px (default), 12px (cards), 16px (modals)
- Width: 1px (default), 2px (focus)

**Shadows:**
- sm: Subtle cards
- md: Hover states
- lg: Modals
- xl: Critical dialogs

**Breakpoints:**
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px

---

## Version History

**Version 1.0** - Initial Release
- Complete design system specification
- Aligned with brand strategy
- Tailwind implementation ready
- Accessibility compliant

---

## Next Steps

1. **Review & Approval**
   - Stakeholder review of design system
   - Gather feedback and iterate
   - Finalize specifications

2. **Implementation**
   - Update Tailwind configuration
   - Create component library
   - Document component usage
   - Build Storybook/documentation site

3. **Rollout**
   - Apply to existing components
   - Create new components as needed
   - Train team on design system
   - Establish governance process

4. **Maintenance**
   - Regular audits for consistency
   - Update based on user feedback
   - Evolve with brand and product needs
   - Version control for changes

---

*This design system is a living document. It should be reviewed and updated quarterly to ensure alignment with user needs, brand evolution, and technical capabilities.*