# TASK.md - Auction Functionality Migration to TanStack Query

## Task Overview

**What**: Migrate auction-related functionality from synchronous easy-peasy store to TanStack Query v4 (React Query) with queries and mutations.

**Why**: Improve async data management with modern React Query patterns, leveraging caching, automatic refetching, and improved loading states.

**Scope**: All auction-related queries and mutations in the application.

---

## Current State

### Existing Architecture

The application currently uses a hybrid state management approach:

1. **easy-peasy Store** (`src/model/auctionModel.ts`): Handles auction state, including:
   - `fetchAuctions`: Thunk for fetching auction data
   - `auctionsData`, `collateralData`: Cached auction data
   - `selectedAuction`, `selectedCollateralAuction`: UI state
   - `auctionBid`, `auctionBuy`, `auctionClaim`: Transaction thunks
   - Loading states and form data

2. **TanStack Query** (`src/hooks/useAuctions.ts`): Partially implemented for:
   - `useAuctionEvents`: Infinite queries for blockchain event fetching
   - `useAccountingEngineData`: Query for accounting engine data
   - `useStartAuction`: Mutation with cache invalidation
   - `useRestartAuction`: Mutation with cache invalidation

### Problem Statement

The dual-state approach creates inconsistency:
- Some auction data in easy-peasy store
- Some auction data in TanStack Query
- Components must access both systems
- Thunks mix business logic with state updates
- No unified cache management

---

## Migration Objectives

### Primary Goals

1. **Unified Data Layer**: All auction data fetching via TanStack Query
2. **Better Caching**: Automatic cache invalidation and refetching
3. **Improved DX**: Standardized query/mutation patterns
4. **Type Safety**: Full TypeScript inference with TanStack Query
5. **Performance**: Optimized data fetching with infinite queries

### Secondary Goals

- Consistent error handling across all auction operations
- Better loading state management
- Reduced bundle size by removing unused easy-peasy state
- Improved testability of auction functionality

---

## Scope Details

### In Scope

#### Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/model/auctionModel.ts` | Refactor | Move query logic to hooks, keep only UI state |
| `src/hooks/useAuctions.ts` | Enhance | Add missing queries, convert thunks to mutations |
| `src/hooks/useAuctionsData.tsx` | Update | Use TanStack Query instead of store selectors |
| `src/containers/Auctions/AuctionsList.tsx` | Update | Remove store dependencies |
| `src/containers/Auctions/AuctionTable/index.tsx` | Update | Remove store dependencies |
| `src/components/Modal/AuctionModal/index.tsx` | Update | Use hooks instead of store |
| `src/utils/auctions/handlers.ts` | Keep | Transaction logic stays (pure functions) |

#### Functionality to Migrate

1. **Data Fetching**
   - [x] `useAuctionEvents` - Already using TanStack Query
   - [ ] `fetchAuctionsData` - Move from thunk to query
   - [ ] `fetchCollateralData` - Move from thunk to query
   - [ ] `getSurplusAuctions` - Already in `useAuctionEvents`
   - [ ] `getDebtAuctions` - Already in `useAuctionEvents`
   - [ ] `getCollateralAuctions` - Already in `useAuctionEvents`

2. **Data Mutations**
   - [ ] `auctionBid` - Convert thunk to mutation
   - [ ] `auctionBuy` - Convert thunk to mutation
   - [ ] `auctionClaim` - Convert thunk to mutation
   - [x] `useStartAuction` - Already using mutation pattern
   - [x] `useRestartAuction` - Already using mutation pattern
   - [ ] `auctionClaimInternalBalance` - Convert thunk to mutation

3. **UI State** (Keep in easy-peasy or move to local state)
   - `selectedAuction` → local state or query parameter
   - `selectedCollateralAuction` → local state or query parameter
   - `amount` → local state in component
   - `collateralAmount` → local state in component
   - `isSubmitting` → mutation `isPending` state

### Out of Scope

- Staking-related functionality (separate migration)
- Vault management functionality (separate migration)
- GraphQL queries (already using Apollo, not part of this task)
- Wallet connection state (managed by wagmi)
- Transaction history (managed by existing store pattern)

---

## Key Considerations

### 1. Query Key Organization

Use consistent query key structure:

```typescript
const auctionKeys = {
    all: ['auctions'] as const,
    events: {
        surplus: ['auctions', 'events', 'surplus'] as const,
        debt: ['auctions', 'events', 'debt'] as const,
        collateral: (token: string) => ['auctions', 'events', 'collateral', token] as const,
    },
    data: ['auctions', 'data'] as const,
    collateral: (token: string, auctionIds: string[]) =>
        ['auctions', 'collateral', token, auctionIds] as const,
    userBids: (address: string) => ['auctions', 'userBids', address] as const,
}
```

### 2. Mutation Pattern

Convert thunk-based transactions to mutations:

```typescript
// BEFORE (easy-peasy thunk)
auctionBid: thunk(async (actions, payload, { getStoreActions }) => {
    const txResponse = await handleAuctionBid(payload)
    if (txResponse) {
        actions.setIsSubmitting(true)
        const { hash } = txResponse
        getStoreActions().transactionsModel.addTransaction({ hash, ... })
        getStoreActions().popupsModel.setIsWaitingModalOpen(true)
        await txResponse.wait()
        actions.setIsSubmitting(false)
    }
})

// AFTER (TanStack Query mutation)
export function useAuctionBid() {
    const queryClient = useQueryClient()
    const transactionsActions = useStoreActions(actions => actions.transactionsModel)
    const popupsActions = useStoreActions(actions => actions.popupsModel)

    return useMutation({
        mutationFn: (params: IAuctionBid) => handleAuctionBid(params),
        onSuccess: (tx, params) => {
            if (tx) {
                const { hash, chainId } = tx
                transactionsActions.addTransaction({
                    chainId,
                    hash,
                    from: tx.from,
                    summary: params.title,
                    addedTime: Date.now(),
                    originalTx: tx,
                })
                popupsActions.setIsWaitingModalOpen(true)
                popupsActions.setWaitingPayload({
                    title: 'Transaction Submitted',
                    hash: tx.hash,
                    status: ActionState.SUCCESS,
                })
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['auctionEvents'] })
        },
    })
}
```

### 3. Loading State Management

Replace `isSubmitting` from store with mutation state:

```typescript
const { mutate: placeBid, isPending } = useAuctionBid()

// Use isPending instead of store isSubmitting
<Button disabled={isPending}>
    {isPending ? 'Submitting...' : 'Place Bid'}
</Button>
```

### 4. Cache Invalidation

After mutations, invalidate relevant queries:

```typescript
onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['surplusAuctionEvents'] })
    queryClient.invalidateQueries({ queryKey: ['debtAuctionEvents'] })
    queryClient.invalidateQueries({ queryKey: ['collateralAuctionEvents'] })
}
```

### 5. Error Handling

Consistent error handling across mutations:

```typescript
return useMutation({
    mutationFn: (params: AuctionParams) => handleAuctionTransaction(params),
    onError: (error) => {
        popupsActions.setWaitingPayload({
            title: 'Transaction Failed',
            status: ActionState.ERROR,
        })
        console.error('Auction transaction failed:', error)
    },
})
```

### 6. Data Transformation

Keep transformation logic in query functions:

```typescript
const { data: auctions } = useQuery({
    queryKey: ['auctionEvents', type],
    queryFn: async () => {
        const rawEvents = await fetchEvents(...)
        return rawEvents.map(transformToAuction)
    },
})
```

---

## Implementation Steps

### Phase 1: Setup and Infrastructure

1. **Review existing TanStack Query patterns**
   - Examine `src/hooks/useAuctions.ts` for existing patterns
   - Review `src/hooks/staking/` for established conventions
   - Check `src/hooks/staking/stakeQueryKeys.ts` for query key patterns

2. **Create query key factory**
   - Define consistent query keys in a dedicated file
   - Export helper functions for common keys

3. **Verify QueryClient configuration**
   - Confirm setup in `src/index.tsx`
   - Configure appropriate default options (stale times, retries)

### Phase 2: Convert Queries

1. **Migrate `fetchAuctionsData`**
   - Create `useAuctionsData` query hook
   - Move logic from `auctionModel.fetchAuctionsData` thunk
   - Update `useAuctionsData.tsx` to use new hook

2. **Migrate `fetchCollateralData`**
   - Create `useCollateralAuctionData` query hook
   - Move logic from `auctionModel.fetchCollateralData` thunk
   - Update `AuctionTable` to use new hook

3. **Update Components**
   - `AuctionsList.tsx` - Replace store selectors with hook results
   - `AuctionTable/index.tsx` - Replace store actions with hook mutations
   - `AuctionModal/index.tsx` - Use new hooks for data and actions

### Phase 3: Convert Mutations

1. **Create mutation hooks**
   - `useAuctionBid()`
   - `useAuctionBuy()`
   - `useAuctionClaim()`
   - `useClaimInternalBalance()`

2. **Update thunk implementations**
   - Replace thunk implementations with calls to pure handler functions
   - Keep handler functions in `src/utils/auctions/handlers.ts`

3. **Integrate with components**
   - Replace `useStoreActions` calls with mutation hooks
   - Remove `isSubmitting` state (use `isPending` from mutation)

### Phase 4: Cleanup

1. **Remove unused store state**
   - Remove migrated actions from `auctionModel`
   - Remove selectors accessing migrated state
   - Consider keeping UI state (modals, form inputs) in store if shared

2. **Update tests**
   - Add tests for new query hooks
   - Add tests for new mutation hooks
   - Update component tests to use new patterns

3. **Verify functionality**
   - Test auction listing and filtering
   - Test bid placement flow
   - Test claim flow
   - Test cache invalidation

---

## Dependencies and References

### Internal Dependencies

| Module | Relationship |
|--------|--------------|
| `src/model/auctionModel.ts` | Source of truth to migrate from |
| `src/hooks/useAuctions.ts` | Base for new queries |
| `src/utils/auctions/handlers.ts` | Pure transaction functions |
| `src/types/auctions.ts` | Type definitions |
| `src/store.ts` | easy-peasy store (keep for UI state) |

### External Dependencies

| Package | Usage |
|---------|-------|
| `@tanstack/react-query` | Query/mutation hooks |
| `wagmi` | Wallet connection, public client |
| `viem` | Blockchain event fetching |
| `@hai-on-op/sdk` | GEB protocol interactions |

### Related Files

- `src/hooks/staking/useStakeMutations.ts` - Reference for mutation pattern
- `src/hooks/staking/stakeQueryKeys.ts` - Reference for query key organization
- `src/containers/Auctions/AuctionsList.tsx` - Main consumer to update

---

## Success Criteria

### Functional Requirements

- [ ] All auction data fetched via TanStack Query
- [ ] All auction transactions via TanStack Query mutations
- [ ] No regression in auction functionality
- [ ] Consistent loading states across all auction operations
- [ ] Proper error handling and user feedback

### Technical Requirements

- [ ] No `as any` or type suppressions added
- [ ] All new code has test coverage
- [ ] ESLint passes without new warnings
- [ ] TypeScript compilation succeeds

### Performance Requirements

- [ ] Improved perceived performance with proper caching
- [ ] Reduced unnecessary refetching
- [ ] Efficient cache invalidation

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cache inconsistency between easy-peasy and TanStack Query | Medium | Aggressive cache invalidation after mutations |
| Component regression from store access pattern | High | Thorough testing, incremental migration |
| Missing edge cases in auction logic | Medium | Review existing tests, add regression tests |
| Performance regression from over-fetching | Low | Configure appropriate stale times |

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Phase 1: Setup | 1-2 hours | 0.5 day |
| Phase 2: Convert Queries | 2-4 hours | 1 day |
| Phase 3: Convert Mutations | 4-6 hours | 1-2 days |
| Phase 4: Cleanup | 2-3 hours | 0.5 day |
| Testing | 2-4 hours | 1 day |

**Total Estimated**: 4-6 days

---

## Notes for AI Agents

### Before Making Changes

1. **Read AGENTS.md** for codebase conventions
2. **Review existing TanStack Query usage** in `src/hooks/useAuctions.ts`
3. **Check for related patterns** in `src/hooks/staking/`
4. **Understand the full flow** before modifying any component

### During Implementation

1. **Maintain backward compatibility** where possible
2. **Add tests for new functionality**
3. **Use proper TypeScript types** (no `any`)
4. **Follow import ordering** conventions
5. **Update this file** with any scope changes

### Testing Requirements

1. Run existing tests: `yarn test`
2. Add unit tests for new hooks
3. Add integration tests for auction flows
4. Verify no regressions in existing functionality

### Common Pitfalls

1. **Forgetting cache invalidation** - Always invalidate after mutations
2. **Mixed state access** - Components should use one pattern consistently
3. **Missing error handling** - Mutations must handle errors gracefully
4. **Loading state confusion** - Use `isPending` not `isLoading` for mutations

---

## References

- [TanStack Query v4 Documentation](https://tanstack.com/query/latest)
- [Existing Auction Hooks](../hooks/useAuctions.ts)
- [Mutation Pattern Reference](../hooks/staking/useStakeMutations.ts)
- [Query Key Pattern Reference](../hooks/staking/stakeQueryKeys.ts)
- [Easy Peasy Documentation](https://easy-peasy.vercel.app/)
