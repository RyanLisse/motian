---
title: Framework Documentation Research - Kandidaat Profiel Pipeline Koppeling
date: 2026-03-05
type: research
---

# Framework Documentation Research

Research findings for technologies used in the kandidaat profiel + pipeline koppeling feature implementation.

## Project Environment

**Current Versions:**
- Next.js: `^16.1.6`
- React: `^19.2.4`
- Drizzle ORM: `^0.38.4`
- Zod: `^3.25.76`
- Node.js: 20.9.0+ (minimum for Next.js 16)

## 1. Next.js 16 App Router

### Breaking Changes & Deprecations

**❌ DEPRECATED: `router.refresh()` from Client Components**

In Next.js 16, the routing system underwent a complete overhaul. The `refresh()` function can **only be called from Server Actions** and cannot be used in Route Handlers, Client Components, or any other context.

**✅ NEW PATTERN:**

```typescript
'use server'
import { refresh } from 'next/cache'

export async function createPost(formData: FormData) {
  const post = await db.post.create({ data: { ... } })
  refresh() // Refreshes client router
}
```

For client-side updates after API calls, use `router.push()` or `revalidatePath()` from Server Actions.

**Async Request APIs Required**

Next.js 16 fully removes synchronous access to Request APIs. All `params` and `searchParams` must now use async/await:

```typescript
// ❌ Old (Next.js 15)
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div>
}

// ✅ New (Next.js 16)
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <div>{id}</div>
}
```

### API Routes with POST Requests

**Pattern from Context7 Documentation:**

```typescript
import { revalidatePath } from 'next/cache'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Process data
  const result = await processData(body)

  // Revalidate affected paths
  revalidatePath('/professionals')
  revalidatePath('/pipeline')

  return Response.json({ data: result }, { status: 201 })
}
```

**Key Points:**
- Use `Response.json()` (Web API standard)
- Call `revalidatePath()` to invalidate caches
- Return proper HTTP status codes (201 for creation, 200 for updates)

### Multi-Step Forms with State Management

**Recommended Pattern (2026):**

```typescript
'use client'
import { useState } from 'react'

export function MultiStepWizard() {
  const [step, setStep] = useState<'profile' | 'linking' | 'done'>('profile')
  const [candidateId, setCandidateId] = useState<string | null>(null)

  const handleProfileSubmit = async (data: ProfileData) => {
    const response = await fetch('/api/kandidaten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (response.ok) {
      const { data: candidate } = await response.json()
      setCandidateId(candidate.id)
      setStep('linking')
    }
  }

  if (step === 'profile') return <ProfileStep onSubmit={handleProfileSubmit} />
  if (step === 'linking') return <LinkingStep candidateId={candidateId!} />
  return <SuccessStep />
}
```

**Best Practices:**
- Use `useState` for step tracking (not `useReducer` unless complex state)
- Persist candidate at Step 1 (backend creates record immediately)
- Pass data via props between steps
- For persistence across page refreshes, combine with `localStorage` and `useEffect`

### Cache Management

**`revalidatePath()` Usage:**

```typescript
import { revalidatePath } from 'next/cache'

// Single path
revalidatePath('/professionals')

// With layout option
revalidatePath('/professionals', 'layout') // Revalidates all nested pages

// Dynamic paths
revalidatePath(`/professionals/${candidateId}`)
```

**When to revalidate:**
- After creating/updating/deleting resources
- Multiple paths if data appears on multiple pages
- Use in Server Actions or Route Handlers (not Client Components)

**Sources:**
- [Next.js 16 Official Docs](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [revalidatePath API Reference](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16)

## 2. Drizzle ORM

### Query Patterns for PostgreSQL

**Select with Conditions:**

```typescript
import { eq, and, isNull } from 'drizzle-orm'

const candidate = await db
  .select()
  .from(candidates)
  .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
  .limit(1)

return candidate[0] ?? null
```

**Checking for Existing Records:**

```typescript
import { eq, and } from 'drizzle-orm'

const existing = await db
  .select({ id: applications.id })
  .from(applications)
  .where(
    and(
      eq(applications.jobId, jobId),
      eq(applications.candidateId, candidateId),
      isNull(applications.deletedAt)
    )
  )
  .limit(1)

if (existing.length > 0) {
  // Record already exists
}
```

### Transactions with Multiple Operations

**Batch API (Recommended for 2026):**

```typescript
const batchResponse = await db.batch([
  db.insert(applications).values({
    jobId: '...',
    candidateId: '...',
    stage: 'screening'
  }).returning(),

  db.update(candidates).set({
    updatedAt: new Date()
  }).where(eq(candidates.id, candidateId)),

  db.select().from(applications).where(eq(applications.candidateId, candidateId))
])

// batchResponse[0] = insert result
// batchResponse[1] = update result
// batchResponse[2] = select result
```

**Transaction API (for complex logic):**

```typescript
await db.transaction(async (tx) => {
  const app = await tx.insert(applications).values({ ... }).returning()
  await tx.update(jobMatches).set({ status: 'approved' }).where(eq(jobMatches.id, matchId))
  return app[0]
})
```

### Handling Unique Constraint Violations

**onConflictDoNothing (Idempotent Insert):**

```typescript
// Option 1: Auto-detect conflict target
await db.insert(applications)
  .values({ jobId, candidateId, stage: 'screening' })
  .onConflictDoNothing()

// Option 2: Explicit target (recommended)
await db.insert(applications)
  .values({ jobId, candidateId, stage: 'screening' })
  .onConflictDoNothing({
    target: [applications.jobId, applications.candidateId]
  })
```

**onConflictDoUpdate (Upsert):**

```typescript
await db.insert(applications)
  .values({ jobId, candidateId, stage: 'screening', source: 'match' })
  .onConflictDoUpdate({
    target: [applications.jobId, applications.candidateId],
    set: {
      stage: 'screening',
      source: 'match',
      updatedAt: new Date()
    }
  })
```

**Catching Constraint Violations:**

```typescript
try {
  await db.insert(applications).values({ ... })
} catch (error) {
  if (error.code === '23505') { // PostgreSQL unique violation code
    return { error: 'Al gekoppeld', alreadyLinked: true }
  }
  throw error
}
```

**Best Practices (2026):**
- Use explicit `target` for composite unique constraints
- For function-based indexes (e.g., `lower(email)`), specify constraint name: `.onConflictDoNothing({ target: 'user_email_unique_idx' })`
- Prefer `onConflictDoNothing()` for idempotent operations
- Use batch API for multiple related operations (faster than separate queries)

**Sources:**
- [Drizzle ORM Insert Documentation](https://orm.drizzle.team/docs/insert)
- [Drizzle Batch API](https://orm.drizzle.team/docs/batch-api)
- [Drizzle PostgreSQL Best Practices 2025](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)

## 3. Zod Validation

### Schema Composition with Reusable Schemas

**Base Schema Reuse:**

```typescript
import { z } from 'zod'

// Reusable base schemas
const uuidSchema = z.string().uuid()
const emailSchema = z.string().email().optional()

// Composed schema
const createApplicationSchema = z.object({
  jobId: uuidSchema,
  candidateId: uuidSchema,
  matchId: uuidSchema.optional(),
  stage: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']),
  source: z.enum(['manual', 'match', 'referral', 'direct']).default('manual'),
})

// Extend existing schema
const updateApplicationSchema = createApplicationSchema.partial().required({ stage: true })
```

**Array Validation:**

```typescript
const experienceSchema = z.array(
  z.object({
    title: z.string().min(1),
    company: z.string().min(1),
    duration: z.string().min(1),
  })
).optional()

const skillsSchema = z.array(z.string().min(1)).optional()
```

### Error Handling and Custom Messages

**safeParse Pattern (Recommended for API Routes):**

```typescript
export const POST = async (request: Request) => {
  const body = await request.json()
  const parsed = createApplicationSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      {
        error: 'Ongeldige invoer',
        details: parsed.error.flatten()
      },
      { status: 400 }
    )
  }

  // Type-safe access to validated data
  const application = await createApplication(parsed.data)
  return Response.json({ data: application }, { status: 201 })
}
```

**Custom Error Messages:**

```typescript
const candidateSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  email: z.string().email('Ongeldig e-mailadres').optional(),
  role: z.string().min(1, 'Rol is verplicht'),
  hourlyRate: z.number().int().positive('Tarief moet positief zijn').optional(),
})
```

**Custom Validation with .refine():**

```typescript
const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'Einddatum moet na startdatum zijn',
    path: ['endDate'], // Error attached to endDate field
  }
)
```

### Validating UUID Fields and Optional Parameters

**UUID Validation:**

```typescript
const matchIdSchema = z.string().uuid('Ongeldige match ID')

// Array of UUIDs
const matchIdsSchema = z.array(z.string().uuid()).min(1, 'Selecteer minimaal 1 match')
```

**Preprocessing (Coercion):**

```typescript
// Convert string to number
const hourlyRateSchema = z.preprocess(
  (v) => (v === undefined || v === null ? undefined : Number(v)),
  z.number().min(0).optional()
)

// Trim strings
const nameSchema = z.preprocess(
  (v) => typeof v === 'string' ? v.trim() : v,
  z.string().min(1, 'Naam is verplicht')
)

// Date coercion
const deadlineSchema = z.coerce.date().optional()
```

**Optional vs Nullable:**

```typescript
// Optional: field can be missing from object
const emailSchema = z.string().email().optional()

// Nullable: field can be null (but must exist)
const matchIdSchema = z.string().uuid().nullable()

// Both: field can be missing OR null
const notesSchema = z.string().optional().nullable()
```

**Best Practices (2026):**
- Use `.safeParse()` in API routes (returns discriminated union)
- Use `.parse()` when you want errors to throw (e.g., internal functions)
- Add Dutch error messages for user-facing validation
- Use `.refine()` for cross-field validation
- Use `.preprocess()` for data normalization (trim, coerce)

**Sources:**
- [Zod GitHub README](https://github.com/colinhacks/zod)
- [Zod API Documentation](https://github.com/colinhacks/zod/blob/v3.24.2/README.md)
- [Zod Error Handling](https://github.com/colinhacks/zod/blob/v3.24.2/ERROR_HANDLING.md)

## 4. React Hooks Best Practices (2026)

### useState and useEffect in Multi-Step Forms

**Modern Best Practices:**

1. **useState for Simple State (Preferred):**

```typescript
'use client'
import { useState } from 'react'

export function Wizard() {
  const [step, setStep] = useState<'profile' | 'linking'>('profile')
  const [candidateId, setCandidateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Simple, readable, performant
}
```

2. **useEffect for Side Effects (Not Data Fetching):**

```typescript
// ✅ GOOD: Synchronizing with external system
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }
  window.addEventListener('keydown', handleEscape)
  return () => window.removeEventListener('keydown', handleEscape)
}, [setOpen])

// ✅ GOOD: Persisting form state to localStorage
useEffect(() => {
  if (candidateId) {
    localStorage.setItem('draft-candidate-id', candidateId)
  }
}, [candidateId])

// ❌ BAD: Data fetching (use TanStack Query or Server Components instead)
useEffect(() => {
  fetch('/api/matches').then(r => r.json()).then(setMatches)
}, [])
```

3. **React 19+ use() Hook for Data Fetching:**

```typescript
import { use } from 'react'

export function MatchResults({ matchesPromise }: { matchesPromise: Promise<Match[]> }) {
  const matches = use(matchesPromise) // Suspends until resolved
  return <div>{matches.map(...)}</div>
}
```

**Rules of Hooks (Enforced):**
- Only call Hooks at the top level (never in loops, conditions, or nested functions)
- Only call Hooks from React functions (components or custom hooks)

**React Compiler (2026):**
- **useMemo** and **useCallback** are now rarely needed
- The React Compiler (stable in Next.js 16) automatically memoizes components
- Reserve manual memoization for measured bottlenecks only

### Multi-Step Form Patterns

**Pattern 1: React Hook Form + Zod (Recommended for Complex Forms):**

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

function Step1() {
  const form = useForm({
    resolver: zodResolver(profileSchema),
  })

  const onSubmit = form.handleSubmit(async (data) => {
    await onStepComplete(data)
  })

  return <form onSubmit={onSubmit}>...</form>
}
```

**Pattern 2: Simple useState (Recommended for This Project):**

```typescript
function Wizard() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<Partial<CandidateData>>({})

  const handleStep1Submit = (data: Step1Data) => {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(2)
  }

  return step === 1 ? <Step1 onSubmit={handleStep1Submit} /> : <Step2 data={formData} />
}
```

**State Persistence Across Refreshes:**

```typescript
useEffect(() => {
  // Save to localStorage on change
  if (formData.name) {
    localStorage.setItem('candidate-draft', JSON.stringify(formData))
  }
}, [formData])

useEffect(() => {
  // Restore from localStorage on mount
  const draft = localStorage.getItem('candidate-draft')
  if (draft) {
    setFormData(JSON.parse(draft))
  }
}, [])
```

**Sources:**
- [React Hooks Cheat Sheet - LogRocket](https://blog.logrocket.com/react-hooks-cheat-sheet-solutions-common-problems/)
- [Building Multi-Step Forms with React Hook Form and Zod](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/)
- [React Fundamentals in 2026](https://www.nucamp.co/blog/react-fundamentals-in-2026-components-hooks-react-compiler-and-modern-ui-development)

## 5. shadcn/ui Components

### Dialog Component Patterns

**Basic Dialog with Multi-Step Content:**

```typescript
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function MultiStepDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open Wizard</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Profiel Aanmaken' : 'Koppel aan Vacatures'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? <Step1 onNext={() => setStep(2)} /> : <Step2 />}
      </DialogContent>
    </Dialog>
  )
}
```

**Key Properties:**
- `open` / `onOpenChange`: Controlled state
- `showCloseButton={false}`: Hide close button if needed
- `className="max-h-[90vh] overflow-y-auto"`: Scrollable long content

### Form Component Integration

**Form with Validation:**

```typescript
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'

export function ProfileForm() {
  const form = useForm()

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Naam *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="John Doe" />
              </FormControl>
              <FormMessage /> {/* Shows validation errors */}
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
```

### Checkbox Component Patterns

**Single Checkbox with Label:**

```typescript
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

<div className="flex items-center gap-2">
  <Checkbox
    id="match-1"
    checked={selected}
    onCheckedChange={setSelected}
  />
  <Label htmlFor="match-1" className="cursor-pointer">
    Senior Developer - Acme Corp (85% match)
  </Label>
</div>
```

**Multiple Checkboxes (Match Selection):**

```typescript
const [selectedMatches, setSelectedMatches] = useState<string[]>(['match-1']) // Pre-select top match

const handleCheckboxChange = (matchId: string, checked: boolean) => {
  setSelectedMatches(prev =>
    checked
      ? [...prev, matchId]
      : prev.filter(id => id !== matchId)
  )
}

return matches.map((match, index) => (
  <div key={match.id} className="flex items-start gap-3 p-4 border rounded">
    <Checkbox
      id={match.id}
      checked={selectedMatches.includes(match.id)}
      onCheckedChange={(checked) => handleCheckboxChange(match.id, checked)}
      disabled={match.isLinked} // Disable if already linked
    />
    <div className="flex-1">
      <Label htmlFor={match.id} className="font-semibold">
        {match.title} - {match.company}
      </Label>
      {match.isLinked && <Badge variant="secondary">Al gekoppeld</Badge>}
    </div>
  </div>
))
```

**Best Practices (2026):**
- **Accessibility**: Pair Checkbox with Label (htmlFor matching id)
- **Mobile**: Increase tap area with padding or wrapper (default is too small)
- **Visual Feedback**: Don't rely on color alone (use icons/badges)
- **States**: Support checked, unchecked, indeterminate (for hierarchical lists)
- **Keyboard**: Space/Enter should toggle (built-in with shadcn)

**Loading States (Skeleton):**

```typescript
import { Skeleton } from '@/components/ui/skeleton'

{loading ? (
  <div className="space-y-4">
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
) : (
  matches.map(match => <MatchCard key={match.id} match={match} />)
)}
```

**Sources:**
- [shadcn/ui Dialog Documentation](https://ui.shadcn.com/docs/components/radix/dialog)
- [shadcn/ui Checkbox Documentation](https://ui.shadcn.com/docs/components/radix/checkbox)
- [shadcn/ui Form Documentation](https://ui.shadcn.com/docs/components/form)
- [Building Forms with shadcn UI](https://medium.com/@enayetflweb/building-forms-with-label-input-textarea-and-checkbox-in-shadcn-ui-211e50a15352)

## Implementation Patterns for This Project

### API Route Handler Pattern (Motian Style)

Based on existing code in `/app/api/kandidaten/route.ts`:

```typescript
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { withApiHandler } from '@/src/lib/api-handler'

export const dynamic = 'force-dynamic'

const createApplicationSchema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
  matchId: z.string().uuid().optional(),
  stage: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']).default('screening'),
})

export const POST = withApiHandler(async (request: Request) => {
  const body = await request.json()
  const parsed = createApplicationSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: 'Ongeldige invoer', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const application = await createApplication(parsed.data)

  // Revalidate multiple paths
  revalidatePath('/professionals')
  revalidatePath('/pipeline')
  revalidatePath(`/professionals/${parsed.data.candidateId}`)

  return Response.json({ data: application }, { status: 201 })
})
```

### Service Layer Pattern (Motian Style)

Based on existing code in `/src/services/applications.ts`:

```typescript
import { db } from '@/src/db'
import { applications } from '@/src/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

export async function createApplication(data: {
  jobId: string
  candidateId: string
  matchId?: string
  source?: string
  stage?: string // NEW: Make stage configurable
  notes?: string
}): Promise<Application> {
  const rows = await db
    .insert(applications)
    .values({
      jobId: data.jobId,
      candidateId: data.candidateId,
      matchId: data.matchId ?? null,
      source: data.source ?? 'manual',
      stage: data.stage ?? 'new', // Default to 'new', allow override
      notes: data.notes ?? null,
    })
    .returning()

  return rows[0]
}

export async function createApplicationsFromMatches(
  candidateId: string,
  matches: Array<{ id: string; jobId: string }>,
  stage: string = 'screening'
): Promise<{ created: Application[]; alreadyLinked: string[] }> {
  const created: Application[] = []
  const alreadyLinked: string[] = []

  for (const match of matches) {
    // Check if already exists
    const existing = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.jobId, match.jobId),
          eq(applications.candidateId, candidateId),
          isNull(applications.deletedAt)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      alreadyLinked.push(match.jobId)
      continue
    }

    // Create new application
    const app = await createApplication({
      jobId: match.jobId,
      candidateId,
      matchId: match.id,
      source: 'match',
      stage,
    })

    created.push(app)
  }

  return { created, alreadyLinked }
}
```

## Key Takeaways for Implementation

1. **Next.js 16**: Use `revalidatePath()` instead of `router.refresh()`, make all `params` async
2. **Drizzle ORM**: Use `onConflictDoNothing()` with explicit targets for idempotent inserts
3. **Zod**: Use `.safeParse()` in API routes, add Dutch error messages
4. **React**: Use simple `useState` for wizard steps, reserve `useEffect` for side effects only
5. **shadcn/ui**: Use Dialog for wizard, Checkbox with Label for selections, Skeleton for loading

## Anti-Patterns to Avoid

- ❌ Using `router.refresh()` from Client Components (removed in Next.js 16)
- ❌ Using `useEffect` for data fetching (use Server Components or TanStack Query)
- ❌ Overusing `useMemo`/`useCallback` (React Compiler handles this now)
- ❌ Not specifying `target` in `onConflictDoNothing()` for composite constraints
- ❌ Throwing errors from `.parse()` in API routes (use `.safeParse()` instead)
- ❌ Small touch targets on mobile checkboxes (add padding)

---

**Research completed:** 2026-03-05
**Technologies researched:** Next.js 16, Drizzle ORM, Zod, React 19, shadcn/ui
**Status:** Ready for implementation
