

# Make Full Bank Description Visible in CSV Review

## Problem
The original bank description (e.g. "PAYMENT GPM Empire 8708 EASTERN CONCRETE FOUND ACH CORP DEBIT") is displayed in tiny 10px text with truncation, making it unreadable. The date also appears redundantly in three places.

## Changes — `src/components/CSVImportModal.tsx`

**Line 469** — Update the description subtitle styling:
- Change `text-[10px]` → `text-xs` (12px, readable)
- Remove `truncate` so the full text wraps naturally
- Change `mt-0.5` → `mt-1` for better spacing

This single 1-line change will make the full bank description wrap and display completely beneath the editable name input.

