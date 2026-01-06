# AGENTS.md

This document provides comprehensive guidance for AI agents working on the HAI Protocol application. It describes the codebase structure, key technologies, patterns, and conventions that agents must follow when understanding and modifying this codebase.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Key Technologies and Patterns](#key-technologies-and-patterns)
- [Data Flow Patterns](#data-flow-patterns)
- [Working with Auction-Related Code](#working-with-auction-related-code)
- [TanStack Query Migration Guidelines](#tanstack-query-migration-guidelines)
- [Testing Expectations](#testing-expectations)
- [Code Style and Conventions](#code-style-and-conventions)
- [Common Patterns](#common-patterns)

---

## Overview

The HAI Protocol application is a decentralized finance (DeFi) platform built on Optimism that enables users to:

- **Manage Vaults**: Create and manage collateralized debt positions (SAFEs)
- **Participate in Auctions**: Bid on surplus, debt, and collateral auctions
- **Stake Tokens**: Stake KITE, HAI-VELO LP, and HAI-Curve LP tokens
- **View Analytics**: Monitor protocol metrics and historical data

The application is currently undergoing a migration from easy-peasy state management to TanStack Query v4 for async data management. This migration is particularly focused on auction-related functionality.

---

## Tech Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 17.0.1 | UI framework |
| TypeScript | 5.1.6 | Type safety |
| Vite | 4.4.9 | Build tool |
| easy-peasy | 3.3.1 | State management (being migrated) |
| TanStack Query | 4.36.1 | Async data fetching (target) |
| Apollo Client | 3.8.8 | GraphQL client |
| wagmi | 1.4.12 | Ethereum React hooks |
| RainbowKit | 1.0.9 | Wallet UI |
| styled-components | 5.2.0 | CSS-in-JS styling |
| Vitest | 0.34.3 | Testing framework |

### Build and Development

- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier
- **Path Aliases**: `~/*` maps to `./src/*` (configured in `tsconfig.json`)
- **Browser Targets**: Configured for modern browsers (>0.2% market share)

---

## Directory Structure

```
app/
├── src/
│   ├── abis/                  # Contract ABIs (JSON and TypeScript)
│   ├── api/                   # API integrations (HAI, KITE supply endpoints)
│   ├── components/            # Reusable UI components
│   │   ├── Charts/            # Chart components (Line, Pie)
│   │   ├── Icons/             # Icon components
│   │   ├── Modal/             # Modal components (Auction, Staking, Vault)
│   │   └── Table/             # Table components
│   ├── config/                # Contract configurations
│   ├── containers/            # Page-level components (routes)
│   │   ├── Analytics/         # Analytics dashboard
│   │   ├── Auctions/          # Auction pages and components
│   │   ├── Contracts/         # Contract explorer
│   │   ├── Earn/              # Earn strategies
│   │   ├── Header/            # Header navigation
│   │   ├── Learn/             # Educational content
│   │   ├── Splash/            # Landing page
│   │   ├── Stake/             # Staking pages
│   │   └── Vaults/            # Vault management
│   ├── hooks/                 # Custom React hooks
│   │   ├── staking/           # Staking-related hooks
│   │   ├── lp/                # LP-related hooks
│   │   ├── haivelo/           # HAI-VELO specific hooks
│   │   └── useAuctions.ts     # Auction hooks (key migration target)
│   ├── model/                 # easy-peasy store definitions
│   ├── providers/             # React Context providers
│   ├── services/              # Business logic services
│   ├── staking/               # Staking configurations
│   ├── styles/                # Global styles and themes
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Utility functions
│   │   ├── auctions/          # Auction utilities and handlers
│   │   ├── gebManager/        # GEB manager utilities
│   │   └── graphql/           # GraphQL queries, fragments, types
│   ├── App.tsx                # Main app component with providers
│   ├── store.ts               # easy-peasy store creation
│   └── index.tsx              # Entry point
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── vite.config.ts             # Vite configuration
```

### Key Directories

#### `src/model/`

Contains easy-peasy store models. Each model file defines state, actions, and thunks for a specific domain:

- `auctionModel.ts` - Auction state (PRIMARY MIGRATION TARGET)
- `connectWalletModel.ts` - Wallet connection state
- `vaultModel.ts` - Vault management state
- `stakingModel.ts` - Staking state
- `transactionsModel.ts` - Transaction history
- `popupsModel.ts` - Modal/popup state
- `settingsModel.ts` - App settings

#### `src/hooks/`

Custom React hooks organized by domain. Many already use TanStack Query:

- `useAuctions.ts` - Auction data fetching with TanStack Query (partially migrated)
- `useAuctionsData.tsx` - Auction data processing and filtering
- `useGeb.ts` - GEB instance management
- `staking/` - Staking hooks with TanStack Query patterns
- `lp/` - LP hooks with TanStack Query patterns

#### `src/utils/auctions/`

Auction-specific utilities:

- `handlers.ts` - Transaction handlers (bid, buy, claim)
- `utils.ts` - Auction status calculation, query conversion
- `format.ts` - Auction formatting utilities

#### `src/utils/graphql/`

GraphQL infrastructure:

- `queries.ts` - All GraphQL query definitions
- `fragments.ts` - Reusable GraphQL fragments
- `types.ts` - TypeScript types for GraphQL responses
- `client.ts` - Apollo Client configuration

---

## Key Technologies and Patterns

### GraphQL Usage

The application uses Apollo Client for GraphQL queries to the protocol's subgraph:

```typescript
// Example: Fetching auction bids for a user
import { useQuery, gql } from '@apollo/client'

const MY_AUCTION_BIDS_QUERY = gql`
    query MyBids($address: Bytes!) {
        englishAuctionBids(where: { bidder: $address }) {
            id
            type
            auction { auctionId englishAuctionType }
            sellAmount
            buyAmount
            price
        }
    }
`
```

**Key Files:**
- `src/utils/graphql/client.ts` - Apollo Client setup with network-specific endpoints
- `src/utils/graphql/queries.ts` - All query definitions
- `src/utils/graphql/types.ts` - Response type definitions

### State Management (Dual System)

The application currently uses a hybrid state management approach:

1. **easy-peasy** (legacy): Global state for app-wide data
   - Store created in `src/store.ts`
   - Models in `src/model/`
   - Hooks: `useStoreState`, `useStoreActions`, `useStoreDispatch`

2. **TanStack Query v4** (modern): Async data fetching
   - QueryClientProvider in `src/index.tsx`
   - Hooks: `useQuery`, `useMutation`, `useInfiniteQuery`
   - Already used in `useAuctions.ts` and many staking hooks

### TanStack Query Patterns in Use

The application already has established patterns for TanStack Query:

```typescript
// Infinite query for paginated data
useInfiniteQuery({
    queryKey: ['surplusAuctionEvents'],
    queryFn: async ({ pageParam }) => { /* ... */ },
    getNextPageParam: (lastPage) => ({ fromBlock: lastPage.toBlock + 1 }),
    enabled: latestBlock !== undefined,
})

// Query invalidation after mutations
queryClient.invalidateQueries({ queryKey: ['surplusAuctionEvents'] })
```

---

## Data Flow Patterns

### Current Auction Data Flow

```
Blockchain Events (via viem/wagmi)
         │
         ▼
┌────────────────────────┐
│   useAuctionEvents     │  ← TanStack Query (useInfiniteQuery)
│   (useAuctions.ts)     │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│   useAuctionsData      │  ← Data processing & filtering
│   (useAuctionsData.tsx)│
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│   AuctionsList         │  ← UI Component
│   (AuctionsList.tsx)   │
└────────────────────────┘
```

### Mixed State Access

Many components still access easy-peasy store for wallet/state:

```typescript
// From useAuctionsData.tsx
const { address } = useAccount()
const { connectWalletModel: { proxyAddress } } = useStoreState((state) => state)
```

### Transaction Flow

```
User Action
    │
    ▼
Handler Function (src/utils/auctions/handlers.ts)
    │
    ▼
Transaction via GEB Proxy
    │
    ▼
Update Transaction Store (easy-peasy)
    │
    ▼
Open Waiting Modal (easy-peasy)
    │
    ▼
Wait for Confirmation
    │
    ▼
Invalidate Queries (TanStack Query)
    │
    ▼
Close Modal (easy-peasy)
```

---

## Working with Auction-Related Code

### Key Files for Auction Functionality

| File | Purpose |
|------|---------|
| `src/model/auctionModel.ts` | easy-peasy store for auctions (TO MIGRATE) |
| `src/hooks/useAuctions.ts` | TanStack Query hooks for auction events (PARTIALLY MIGRATED) |
| `src/hooks/useAuctionsData.tsx` | Data processing and filtering |
| `src/utils/auctions/handlers.ts` | Transaction handlers |
| `src/utils/auctions/utils.ts` | Auction utilities |
| `src/types/auctions.ts` | Auction type definitions |
| `src/containers/Auctions/` | Auction UI components |

### Auction Types

```typescript
// From src/types/auctions.ts
type AuctionEventType = 'DEBT' | 'SURPLUS' | 'COLLATERAL'

interface IAuction {
    auctionId: string
    auctionDeadline: string
    englishAuctionType: AuctionEventType
    sellToken: string
    buyToken: string
    sellAmount: string
    buyAmount: string
    isClaimed: boolean
    biddersList: IAuctionBidder[]
    status: Status  // LIVE, COMPLETED, RESTARTING, SETTLING
}
```

### Auction Flow Operations

1. **Fetching**: `useAuctionEvents()` - Uses `useInfiniteQuery` to fetch blockchain events
2. **Processing**: `useAuctionsData()` - Filters, sorts, transforms data
3. **Actions**:
   - `handleAuctionBid()` - Place bid on surplus/debt auction
   - `handleAuctionBuy()` - Buy collateral from collateral auction
   - `handleAuctionClaim()` - Claim won auction
   - `handleClaimInternalBalance()` - Claim accumulated balance

### Integration Points

- **Wallet**: `useAccount()` from wagmi for address
- **Geb**: `useGeb()` hook for protocol interaction
- **Store**: `useStoreActions` for modals and transactions
- **QueryClient**: `useQueryClient()` for cache invalidation

---

## TanStack Query Migration Guidelines

### Migration Strategy

The migration from easy-peasy to TanStack Query follows this pattern:

1. **Identify state**: Determine if state is local UI state or server/async state
2. **Create queries**: Replace thunk-based fetching with `useQuery` or `useInfiniteQuery`
3. **Create mutations**: Replace thunk-based transactions with `useMutation`
4. **Update components**: Replace `useStoreState`/`useStoreActions` with hook results
5. **Maintain integration**: Keep easy-peasy for local UI state (modals, forms)

### Query Organization

```typescript
// Group queries by domain
const queryKeys = {
    auctions: {
        all: ['auctions'] as const,
        surplus: ['auctions', 'surplus'] as const,
        debt: ['auctions', 'debt'] as const,
        collateral: (token: string) => ['auctions', 'collateral', token] as const,
        bids: (address: string) => ['auctions', 'bids', address] as const,
    },
}
```

### Mutation Pattern

```typescript
export function useAuctionMutation() {
    const queryClient = useQueryClient()
    const { popupsModel, transactionsModel } = useStoreActions(actions => actions)

    return useMutation({
        mutationFn: async (params: AuctionParams) => {
            const tx = await handleAuctionBid(params)
            return tx
        },
        onSuccess: (tx) => {
            // Update transaction store
            transactionsModel.addTransaction({ /* ... */ })
            // Show modal
            popupsModel.setIsWaitingModalOpen(true)
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['surplusAuctionEvents'] })
        },
    })
}
```

### Loading and Error States

```typescript
const { data, isLoading, error } = useQuery({
    queryKey: ['auctionData', auctionId],
    queryFn: () => fetchAuctionData(auctionId),
    // Keep previous data while loading new data
    placeholderData: keepPreviousData,
})
```

### Infinite Query Pattern for Events

```typescript
useInfiniteQuery({
    queryKey: ['auctionEvents', type],
    queryFn: async ({ pageParam }) => {
        const { fromBlock, toBlock } = pageParam
        return fetchEvents(fromBlock, toBlock)
    },
    initialPageParam: { fromBlock: 1, toBlock: BLOCK_INTERVAL },
    getNextPageParam: (lastPage) => ({
        fromBlock: lastPage.toBlock + 1,
        toBlock: lastPage.toBlock + BLOCK_INTERVAL,
    }),
})
```

---

## Testing Expectations

### Testing Framework

- **Vitest** - Test runner
- **React Testing Library** - Component testing
- **jest-dom** - DOM assertions

### Test File Locations

| Pattern | Location |
|---------|---------|
| Unit tests | Alongside source files, e.g., `src/services/__tests__/` |
| Component tests | `__tests__/` folders in containers/components |
| Hook tests | `__tests__/` folders in hooks directories |

### Example Test Pattern

```typescript
// From src/hooks/staking/__tests__/useStakeMutations.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useStakeMutations } from '../useStakeMutations'

describe('useStakeMutations', () => {
    it('should stake tokens successfully', async () => {
        const { result } = renderHook(() => useStakeMutations())

        await actAsync(async () => {
            await result.current.stake('1000')
        })

        expect(result.current.isSuccess).toBe(true)
    })
})
```

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run with coverage
yarn test --coverage
```

---

## Code Style and Conventions

### TypeScript Strict Mode

The project uses TypeScript with `strict: true`. All types must be properly defined. Never use:
- `as any`
- `@ts-ignore`
- `@ts-expect-error`

### Path Aliases

Always use path aliases for imports from `src/`:

```typescript
// Correct
import { useAuctionsData } from '~/hooks'
import type { IAuction } from '~/types'

// Avoid
import { useAuctionsData } from '../../hooks'
```

### Component Patterns

#### Functional Components

All components are functional using React hooks:

```typescript
// Correct
export function AuctionsList() {
    const { isLoading, rows } = useAuctionsData()
    return <div>{isLoading ? <Loader /> : <Table data={rows} />}</div>
}

// Avoid class components
```

#### Hooks Prefix

Custom hooks must start with `use`:

```typescript
// Correct
export function useAuctionEvents() { }

// Incorrect
export function getAuctionEvents() { }
```

### Import Organization

1. React imports
2. Third-party library imports (alphabetical)
3. Path alias imports (alphabetical, using `~/`)
4. Relative imports (alphabetical)

```typescript
import { useEffect, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { formatEther } from 'ethers/lib/utils'
import { useStoreActions } from '~/store'
import { useGeb } from '~/hooks'
import { handleAuctionBid } from '~/utils/auctions/handlers'
```

### Styled Components

Use styled-components with theme access:

```typescript
import styled from 'styled-components'
import { Flex, Text } from '~/styles'

const TableContainer = styled(Flex).attrs({
    $direction: 'column',
    $gap: 16,
})`
    ${({ theme }) => theme.mediaWidth.upToMedium`
        padding: 16px;
    `}
`
```

### Enum Usage

Use TypeScript enums for constants:

```typescript
// From src/utils/constants.ts
export enum Status {
    LIVE = 'LIVE',
    COMPLETED = 'COMPLETED',
    RESTARTING = 'RESTARTING',
    SETTLING = 'SETTLING',
}

export enum ActionState {
    NONE = '',
    LOADING = 'loading',
    SUCCESS = 'success',
    ERROR = 'error',
}
```

---

## Common Patterns

### Query Key Factory

Consistent query key naming for cache management:

```typescript
// src/hooks/staking/stakeQueryKeys.ts
export const stakeQueryKeys = {
    all: ['stake'] as const,
    account: (address: string) => ['stake', 'account', address] as const,
    summary: (address: string) => ['stake', 'summary', address] as const,
    history: (address: string) => ['stake', 'history', address] as const,
}
```

### Error Handling

```typescript
const { data, isError, error } = useQuery({
    queryKey: ['auction', id],
    queryFn: fetchAuction,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
})

if (isError) {
    console.error('Failed to fetch auction:', error)
    return <ErrorMessage>Failed to load auction data</ErrorMessage>
}
```

### Loading States

```typescript
const { isLoading, isFetching } = useQuery({
    queryKey: ['auctions'],
    queryFn: fetchAuctions,
})

if (isLoading) {
    return <SkeletonLoader />
}

// Show data while fetching new data in background
<div>{data}</div>
{isFetching && <LoadingSpinner />}
```

### Wallet-Context Queries

Conditional queries based on wallet connection:

```typescript
const { address } = useAccount()

const { data: userBids } = useQuery({
    queryKey: ['userBids', address],
    queryFn: () => fetchUserBids(address),
    enabled: !!address, // Only run if address exists
})
```

### Mutation with Transaction Tracking

```typescript
const { mutate: placeBid, isPending } = useMutation({
    mutationFn: (params: BidParams) => handleAuctionBid(params),
    onSuccess: (tx) => {
        if (tx) {
            transactionsModel.addTransaction({
                hash: tx.hash,
                summary: 'Place bid on auction',
            })
            popupsModel.setIsWaitingModalOpen(true)
        }
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['auctions'] })
    },
})
```

---

## Important Notes for Agents

1. **Migration in Progress**: The codebase is actively migrating from easy-peasy to TanStack Query. Check if functionality already exists in hooks before adding to easy-peasy store.

2. **Test Coverage**: The project has tests for hooks, services, and components. Add tests for new functionality.

3. **No Type Suppression**: Never use `as any` or `@ts-ignore`. Define proper types.

4. **State Location**: 
   - Server/async state → TanStack Query
   - UI state (modals, forms) → easy-peasy or local state
   - Wallet state → wagmi hooks

5. **GraphQL vs Blockchain**: The app uses both GraphQL (historical/subgraph data) and direct blockchain calls (current events). Use the appropriate method for the use case.

6. **Block Range Queries**: Auction events use infinite queries with large block ranges (1 trillion blocks per page) for efficiency.

7. **Chain ID**: The app primarily targets Optimism (ChainId 10) with testnet support for Optimism Sepolia (ChainId 11155420).

---

## Related Documentation

- [TASK.md](./TASK.md) - Current refactoring task details
- [package.json](./package.json) - Dependencies and scripts
- [tsconfig.json](./tsconfig.json) - TypeScript configuration
- [vite.config.ts](./vite.config.ts) - Build configuration
