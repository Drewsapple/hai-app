import type { IAuction } from '~/types'
import { Status } from '../constants'
import { type QueryEnglishAuction } from '../graphql'

type AuctionStatusProps = {
    auctionDeadline: IAuction['auctionDeadline']
    isClaimed: IAuction['isClaimed']
    englishAuctionType: IAuction['englishAuctionType']
    bids?: Array<{ createdAt: string }>
}
export function getAuctionStatus(auction: AuctionStatusProps, bidDurations: { debt?: number; surplus?: number }) {
    const bids = auction.bids || []

    switch (auction.englishAuctionType) {
        case 'COLLATERAL': {
            if (auction.isClaimed) return Status.COMPLETED
            return Status.LIVE
        }
        case 'DEBT': {
            if (auction.isClaimed) return Status.COMPLETED
            if (bids.length > 1) {
                const { createdAt } = bids[0]
                const timeSinceBid = Date.now() / 1000 - parseInt(createdAt)
                if (
                    Date.now() > 1000 * parseInt(auction.auctionDeadline) ||
                    timeSinceBid > (bidDurations?.debt ?? Infinity)
                ) {
                    return Status.SETTLING
                }
            }
            if (1000 * parseInt(auction.auctionDeadline) > Date.now()) return Status.LIVE
            return Status.RESTARTING
        }
        case 'SURPLUS': {
            if (auction.isClaimed) return Status.COMPLETED
            if (bids.length > 1) {
                const { createdAt } = bids[0]
                const timeSinceBid = Date.now() / 1000 - parseInt(createdAt)
                if (
                    Date.now() > 1000 * parseInt(auction.auctionDeadline) ||
                    timeSinceBid > (bidDurations?.surplus ?? Infinity)
                ) {
                    return Status.SETTLING
                }
            }
            if (1000 * parseInt(auction.auctionDeadline) > Date.now()) return Status.LIVE
            return Status.RESTARTING
        }
    }
}

export function convertQueryAuction(auction: QueryEnglishAuction): IAuction {
    const bids =
        auction.englishAuctionBids?.map((bid) => ({
            ...bid,
            createdAtTransaction: '',
        })) || []
    // add start tx as (mostly) empty bid
    bids.push({
        createdAtTransaction: '',
        id: '',
        sellAmount: '',
        buyAmount: '',
        bidNumber: '-1',
        type: auction.englishAuctionType === 'DEBT' ? 'DECREASE_SOLD' : 'INCREASE_BUY',
        price: '',
        bidder: '',
        createdAt: '',
    })

    const englishAuctionType: IAuction['englishAuctionType'] = (() => {
        switch (auction.englishAuctionType) {
            case 'LIQUIDATION':
                return 'COLLATERAL'
            case 'DEBT':
            case 'SURPLUS':
                return auction.englishAuctionType
            case 'STAKED_TOKEN':
                return 'COLLATERAL'
        }
    })()

    return {
        ...auction,
        biddersList: bids,
        englishAuctionBids: bids,
        englishAuctionType,
        englishAuctionConfiguration: {
            bidDuration: '',
            bidIncrease: '',
            totalAuctionLength: '',
            DEBT_amountSoldIncrease: '',
        },
        createdAtTransaction: '',
    }
}
