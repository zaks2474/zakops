# Scroll Model Documentation

**Date**: 2025-12-29
**Status**: Fixed and Verified

## Single Scroll Model Architecture

The app uses a **viewport-locked layout** where the body never scrolls. Each page manages its own scroll containers.

### Layout Chain

```
body (overflow-hidden)
└── SidebarProvider wrapper (h-screen overflow-hidden flex)
    ├── Sidebar (overflow-y-auto)
    └── SidebarInset (flex-1 min-h-0 overflow-hidden)
        ├── Header (shrink-0)
        └── Page content (flex-1 min-h-0)
            └── [scroll containers defined by each page]
```

### DOM Selectors + Computed Styles

| Component | Selector | Key Classes | Purpose |
|-----------|----------|-------------|---------|
| Body | `body` | `overflow-hidden overscroll-none` | Prevent viewport scroll |
| SidebarProvider | `[data-slot="sidebar-wrapper"]` | `h-screen overflow-hidden flex` | Fixed viewport height |
| SidebarInset | `[data-slot="sidebar-inset"]` | `flex-1 min-h-0 overflow-hidden` | Flex child, no scroll |

### Page-Level Scroll Containers

Each page must define its own scroll container:

| Page | Selector | Key Classes |
|------|----------|-------------|
| Dashboard | `[data-testid="dashboard-scroll"]` | `flex-1 min-h-0 overflow-y-auto` |
| Deals | `[data-testid="deals-scroll"]` | `flex-1 min-h-0 overflow-y-auto` |
| Deal Detail | `[data-testid="deal-detail-scroll"]` | `flex-1 min-h-0 overflow-y-auto` |
| Actions | `[data-testid="actions-scroll"]` | `flex-1 min-h-0 overflow-y-auto` |
| Quarantine | `[data-testid="quarantine-scroll"]` | `flex-1 min-h-0 overflow-y-auto` |
| Chat Messages | `[data-testid="chat-scroll"]` | `flex-1 min-h-0 overflow-y-auto` |

### Files Modified

**Layout Components:**

1. **`src/app/layout.tsx:52`** - Root body
   ```tsx
   <body className="bg-background overflow-hidden overscroll-none ...">
   ```

2. **`src/components/ui/sidebar.tsx:140-142`** - SidebarProvider wrapper
   ```tsx
   className="group/sidebar-wrapper ... flex h-screen w-full overflow-hidden"
   ```

3. **`src/components/ui/sidebar.tsx:312-314`** - SidebarInset
   ```tsx
   className="bg-background ... flex-1 flex-col min-h-0 overflow-hidden"
   ```

**Page Scroll Containers:**

4. **`src/app/dashboard/page.tsx`**
   ```tsx
   <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-4 p-4" data-testid="dashboard-scroll">
   ```

5. **`src/app/deals/page.tsx`** - Deals list with scrollable table card
   ```tsx
   // Page container
   <div className="flex flex-1 flex-col min-h-0 gap-4 p-4">
   // Table card scroll container
   <CardContent className="flex-1 min-h-0 overflow-y-auto" data-testid="deals-scroll">
   ```

6. **`src/app/deals/[id]/page.tsx`** - Deal detail
   ```tsx
   <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-4 p-4" data-testid="deal-detail-scroll">
   ```

7. **`src/app/actions/page.tsx`**
   ```tsx
   <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-4 p-4" data-testid="actions-scroll">
   ```

8. **`src/app/quarantine/page.tsx`**
   ```tsx
   <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-4 p-4" data-testid="quarantine-scroll">
   ```

9. **`src/app/chat/page.tsx`** - Chat with separate message scroll
   ```tsx
   // Page container
   <div className="flex flex-1 flex-col min-h-0">
   // Messages scroll container (inside flex layout)
   <div className="flex-1 min-h-0 overflow-y-auto p-4" data-testid="chat-scroll">
   ```

### Chat Page Structure

```tsx
<div className="flex flex-1 flex-col min-h-0">        // Page container
  <div className="flex ... p-4 border-b">             // Header (fixed)
  {progressIndicator}                                  // Progress (fixed)
  <div className="flex flex-1 overflow-hidden min-h-0"> // Main content
    <div className="flex flex-1 flex-col min-h-0">    // Messages area
      <div className="flex-1 min-h-0 overflow-y-auto"> // SCROLL HERE
        {messages}
      </div>
      <div className="p-4 border-t">                   // Composer (fixed)
        <Input ... />
      </div>
    </div>
    {showEvidence && <aside>...</aside>}               // Optional panels
  </div>
</div>
```

### Auto-scroll Behavior

The chat uses "scroll-only-if-near-bottom" logic:

```tsx
// Track if user is near bottom (within 100px)
const isNearBottomRef = useRef(true);

const updateIsNearBottom = useCallback(() => {
  const container = scrollViewportRef.current;
  if (!container) return;
  const threshold = 100;
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  isNearBottomRef.current = isNearBottom;
}, []);

// Auto-scroll only when near bottom
useEffect(() => {
  if (isNearBottomRef.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }
}, [messages]);
```

This allows users to scroll up to read history without being yanked to the bottom when new messages arrive.

### Verification

Run the following to verify scroll model:

```bash
# All tests should pass (40 tests including scroll container verification)
./click-sweep-test.sh

# Section 8 tests scroll containers:
# ✓ Scroll container Deals table - Present and scrollable
# ✓ Scroll container Chat messages - Present and scrollable
# ✓ Scroll container Dashboard - Present and scrollable
# ✓ Scroll container Actions - Present and scrollable
# ✓ Scroll container Quarantine - Present and scrollable
```

**Manual verification for Deals page:**
1. Go to `/deals` with many deals (e.g., 91 deals)
2. Scroll down using mouse wheel/trackpad
3. Verify you can reach all rows at the bottom
4. Sidebar should remain fixed while scrolling

**Manual verification for Chat:**
1. Go to `/chat`
2. Send multiple messages to create scrollable content
3. Scroll up in messages - composer should stay fixed
4. Send a new message while scrolled up - should NOT auto-scroll to bottom
5. Scroll to bottom, send message - SHOULD auto-scroll to show new message

### Cleanup: Removed Template Routes

The following unused routes were removed to fix build errors:

- `src/app/dashboard/billing/`
- `src/app/dashboard/exclusive/`
- `src/app/dashboard/kanban/`
- `src/app/dashboard/overview/`
- `src/app/dashboard/product/`
- `src/app/dashboard/profile/`
- `src/app/dashboard/workspaces/`
- `src/app/auth/`
- `src/features/kanban/`
- `src/features/overview/`
- `src/features/products/`
- `src/features/profile/`
- `src/features/auth/`
