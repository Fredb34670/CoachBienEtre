# DESIGN.md - Coach Bien-Être

## Visual System

### Colors
- **Primary:** `#d4a5d4` (lavender pastel accent)
- **Primary Dark:** `#c890c8` (darker purple variant)
- **Background:** `#f5f0f5` (soft lavender)
- **Panel Background:** `#ffffff` (white cards)
- **Text:** `#4a3d4a` (warm gray)
- **Light Text:** `#7a6d7a` (muted gray)
- **Border:** `#e8d8e8` (soft separator)
- **Tab Inactive:** `#eee5ee` (light pastel)
- **Tab Hover:** `#e0d0e0` (mid pastel)
- **Shadow Soft:** `0 2px 8px rgba(212, 165, 212, 0.2)`
- **Shadow Medium:** `0 4px 16px rgba(200, 144, 200, 0.25)`

### Typography
- **Body Font:** Georgia, 'Times New Roman', serif
- **Header Style:** Georgia, italic, 1.5rem (h2), 1.15rem (h3), 1.02rem (h4)
- **Body Size:** 1.05rem with 1.7 line-height
- **Display Max:** 6rem with tracking floor -0.04em

### Layout
- **Max Width:** 960px center container
- **Grid:** 2-column hero (photo | text), stack on mobile
- **Padding:** 2rem desktop, 1rem mobile
- **Gaps:** 3rem between columns, 1.2rem between elements

### Components
- **Cards:** Rounded (12px), soft shadows, white background
- **Tabs:** Alternating pattern (odd=white, even=pastel), 10px border-radius top corners
- **Hero:** Grid layout, photo with rounded corners and shadow

### Surface Treatment
- **Cards:** Rounded corners, subtle shadow, white fill
- **Tabs:** Intercalated contrast pattern with border accents
- **Borders:** 2px solid for section dividers

---

## Hero Section Design

### Base Variant (Selected)
The hero heading uses an elevated type treatment that commands attention:
- **Font Size:** 1.8rem (amplified from 1.5rem)
- **Font Weight:** 700 (bold)
- **Font Style:** Normal (not italic)
- **Color:** Dark text (#4a3d4a, var(--text-color))
- **Line Height:** 1.2
- **Letter Spacing:** -0.02em (tightens spacing)
- **Spacing:** Reduced margin-bottom (1rem vs 1.5rem)
- **Border:** Removed (cleaner, more authoritative)

This treatment creates visual hierarchy by making the heading the clear focal point while maintaining brand consistency through the text color and spacing choices.