/**
 * Canonical React Query keys for auction data.
 *
 * Keep this module dependency-free so it can be reused from hooks,
 * services, and tests without creating cycles.
 */
export const auctionQueryKeys = {
    all: ['auctions'] as const,

    /**
     * Base key for all auction events.
     */
    eventsBase: ['auctions', 'events'] as const,

    /**
     * Surplus auction events from blockchain logs.
     */
    surplusEvents: ['auctions', 'events', 'surplus'] as const,

    /**
     * Debt auction events from blockchain logs.
     */
    debtEvents: ['auctions', 'events', 'debt'] as const,

    /**
     * Collateral auction events, filtered by token symbol.
     */
    collateralEvents: (tokenSymbol?: string) => ['auctions', 'events', 'collateral', tokenSymbol] as const,

    /**
     * Accounting engine data for auction parameters.
     */
    accountingEngine: ['auctions', 'accountingEngine'] as const,

    /**
     * Auction data from SDK (fetchAuctionData).
     */
    data: ['auctions', 'data'] as const,

    /**
     * Collateral auction data by token and auction IDs.
     */
    collateralData: (token: string, auctionIds: readonly string[]) =>
        ['auctions', 'collateral', token, ...auctionIds] as const,

    /**
     * User's auction bids from subgraph.
     */
    userBids: (address: string) => ['auctions', 'userBids', address.toLowerCase()] as const,

    /**
     * Auction restarts (for restart detection).
     */
    restarts: ['auctions', 'restarts'] as const,
}
