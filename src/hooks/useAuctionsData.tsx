import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'

import type { AuctionEventType, SortableHeader, Sorting } from '~/types'
import { Status, arrayToSorted, stringExistsAndMatchesOne } from '~/utils'
import { useStoreState } from '~/store'
import { useAuctionEvents } from './useAuctions'

const headers: SortableHeader[] = [
    { label: 'Auction' },
    { label: 'Auction Type' },
    { label: 'For Sale' },
    { label: 'Buy With' },
    { label: 'Time Left' },
    { label: 'My Bids' },
    { label: 'Status' },
]

function mapStatusToNumber(status: Status | undefined) {
    switch (status) {
        case Status.LIVE:
            return 5
        case Status.RESTARTING:
            return 4
        case Status.SETTLING:
            return 3
        case Status.COMPLETED:
            return 2
        default:
            return 1
    }
}

export function useAuctionsData() {
    const { address } = useAccount()

    const {
        connectWalletModel: { proxyAddress },
    } = useStoreState((state) => state)

    const [filterMyBids, setFilterMyBids] = useState(false)
    const [typeFilter, setTypeFilter] = useState<AuctionEventType | undefined>()
    const [statusFilter, setStatusFilter] = useState<Status>()
    const [saleAssetsFilter, setSaleAssetsFilter] = useState<string>()

    const { surplus, debt, collateral } = useAuctionEvents(typeFilter, saleAssetsFilter)

    const combined = useMemo(() => {
        if (typeFilter === 'COLLATERAL' || saleAssetsFilter !== undefined) {
            return {
                isLoading: collateral.isLoading,
                auctions: collateral.data,
                error: collateral.error,
            }
        } else if (typeFilter === 'DEBT') {
            return {
                isLoading: debt.isLoading,
                auctions: debt.data,
                error: debt.error,
            }
        } else if (typeFilter === 'SURPLUS') {
            return {
                isLoading: surplus.isLoading,
                auctions: surplus.data,
                error: surplus.error,
            }
        } else {
            const errors = [collateral.error, surplus.error, debt.error].filter((e) => e !== null)

            return {
                isLoading: surplus.isLoading || debt.isLoading || collateral.isLoading,
                auctions: [
                    ...(collateral.data ?? []),
                    ...(saleAssetsFilter ? [] : surplus.data ?? []),
                    ...(saleAssetsFilter ? [] : debt.data ?? []),
                ],
                error: errors.length > 0 ? new AggregateError(errors) : undefined,
            }
        }
    }, [typeFilter, saleAssetsFilter, collateral, debt, surplus])

    const [sorting, setSorting] = useState<Sorting>({
        key: 'Status',
        dir: 'asc',
    })

    const auctionsWithExtras = useMemo(() => {
        if (combined.isLoading) return []
        const withBids = combined.auctions!.map((auction) => {
            return {
                ...auction,
                myBids: auction.biddersList.reduce((hashes, { bidder, createdAtTransaction }) => {
                    if (stringExistsAndMatchesOne(bidder, [address, proxyAddress])) {
                        if (!hashes.includes(createdAtTransaction)) hashes.push(createdAtTransaction)
                    }
                    return hashes
                }, [] as string[]).length,
            }
        })
        return filterMyBids ? withBids.filter(({ myBids }) => !!myBids) : withBids
    }, [filterMyBids, address, proxyAddress, combined])

    const sortedRows = useMemo(() => {
        switch (sorting.key) {
            case 'Auction':
                return arrayToSorted(auctionsWithExtras, {
                    getProperty: (auction) => auction.auctionId,
                    dir: sorting.dir,
                    type: 'parseInt',
                })
            case 'Auction Type':
                return arrayToSorted(auctionsWithExtras, {
                    getProperty: (auction) => auction.englishAuctionType,
                    dir: sorting.dir,
                    type: 'alphabetical',
                })
            case 'For Sale':
                return arrayToSorted(auctionsWithExtras, {
                    getProperty: (auction) => auction.sellToken,
                    dir: sorting.dir,
                    type: 'alphabetical',
                })
            case 'Buy With':
                return arrayToSorted(auctionsWithExtras, {
                    getProperty: (auction) => auction.buyToken,
                    dir: sorting.dir,
                    type: 'alphabetical',
                })
            case 'My Bids':
                return arrayToSorted(auctionsWithExtras, {
                    getProperty: (auction) => auction.myBids || 0,
                    dir: sorting.dir,
                    type: 'numerical',
                })
            case 'Status':
                return arrayToSorted(
                    auctionsWithExtras.sort((a, b) => {
                        return parseInt(b.auctionDeadline) - parseInt(a.auctionDeadline)
                    }),
                    {
                        getProperty: (auction) => mapStatusToNumber(auction.status),
                        dir: sorting.dir,
                        type: 'numerical',
                        checkValueExists: true,
                    }
                )
            case 'Time Left':
            default:
                return arrayToSorted(auctionsWithExtras, {
                    getProperty: (auction) => auction.auctionDeadline,
                    dir: sorting.dir,
                    type: 'parseInt',
                })
        }
    }, [auctionsWithExtras, sorting])

    return {
        isLoading: combined.isLoading,
        error: combined.error,
        headers,
        rows: sortedRows.filter(({ status }) => statusFilter === undefined || statusFilter === status),
        rowsUnmodified: combined.auctions,
        sorting,
        setSorting,
        filterMyBids,
        setFilterMyBids,
        typeFilter,
        setTypeFilter,
        statusFilter,
        setStatusFilter,
        saleAssetsFilter,
        setSaleAssetsFilter,
    }
}
