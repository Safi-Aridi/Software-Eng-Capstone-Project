Add filtering and sorting to the applications list on CitizenDashboard.

Context: CitizenDashboard.tsx shows a flat list of application cards. There may be many applications over time.

Tasks:
1. Above the applications list, add a filter/sort toolbar with:
   - Status filter dropdown: "All Statuses" | PENDING_REVIEW | VERIFIED | MUKHTAR_SIGNED | PROCESSED | RESUBMISSION_REQUIRED | DELIVERED
   - Sort dropdown: "Newest First" (default) | "Oldest First"
   - A text showing the count: "Showing X of Y applications"

2. Apply the filter and sort reactively — no page reload, pure state.
3. If the filtered result is empty, show a friendly empty state: "No applications match this filter."
4. Preserve the existing RESUBMISSION_REQUIRED warning banners and UNPAID payment banners on the cards — they should still appear when those cards are visible.

Style: Match existing Tailwind CSS design. Keep the toolbar compact and clean.