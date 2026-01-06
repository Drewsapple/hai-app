/**
 * Auction mutations for bid, buy, claim, and restart operations.
 *
 * This hook centralizes all write operations related to auctions and integrates
 * with the easy-peasy store for transaction tracking and modal management.
 */
import { type TransactionResponse } from '@ethersproject/providers'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useStoreActions } from '~/store'
import { useQueryClient as useReactQueryClient } from '@tanstack/react-query'
import type { IAuctionBid } from '~/types'
import type { IAuctionBuy, IClaimInternalBalance } from '~/utils/auctions/handlers'
import {
    handleAuctionBid,
    handleAuctionBuy,
    handleAuctionClaim,
    handleClaimInternalBalance,
} from '~/utils/auctions/handlers'
import { auctionQueryKeys } from './auctionQueryKeys'
import { ActionState } from '~/utils/constants'

type AuctionTxResult = TransactionResponse & { summary?: string }

export function useAuctionMutations() {
    const queryClient = useQueryClient()
    const reactQueryClient = useReactQueryClient()
    const { address } = useAccount()

    const {
        transactionsModel: transactionsActions,
        popupsModel: popupsActions,
    } = useStoreActions((actions) => actions)

    const handleTransactionSuccess = (tx: AuctionTxResult, title: string) => {
        transactionsActions.addTransaction({
            chainId: tx.chainId,
            hash: tx.hash,
            from: tx.from,
            summary: title,
            addedTime: new Date().getTime(),
            originalTx: tx,
        })
        popupsActions.setIsWaitingModalOpen(true)
        popupsActions.setWaitingPayload({
            title: 'Transaction Submitted',
            hash: tx.hash,
            status: ActionState.SUCCESS,
        })
    }

    const handleTransactionError = (error: Error) => {
        console.error('Auction transaction failed:', error)
        popupsActions.setWaitingPayload({
            title: 'Transaction Failed',
            status: ActionState.ERROR,
        })
    }

    /**
     * Place a bid on a surplus or debt auction.
     */
    const auctionBid = useMutation({
        mutationKey: ['auctions', 'mut', 'bid'],
        mutationFn: async (params: IAuctionBid) => {
            if (!address) throw new Error('Wallet not connected')
            const result = await handleAuctionBid(params)
            if (!result) throw new Error('No transaction response')
            return result as unknown as unknown as AuctionTxResult
        },
        onSuccess: (tx, params) => {
            handleTransactionSuccess(tx, params.title)
        },
        onError: handleTransactionError,
        onSettled: () => {
            // Invalidate auction event queries to reflect new bid
            reactQueryClient.invalidateQueries({ queryKey: auctionQueryKeys.surplusEvents })
            reactQueryClient.invalidateQueries({ queryKey: auctionQueryKeys.debtEvents })
            // Close modal after a delay
            setTimeout(() => {
                popupsActions.setIsWaitingModalOpen(false)
                popupsActions.setWaitingPayload({ status: ActionState.NONE })
            }, 2000)
        },
    })

    /**
     * Buy collateral from a collateral auction.
     */
    const auctionBuy = useMutation({
        mutationKey: ['auctions', 'mut', 'buy'],
        mutationFn: async (params: IAuctionBuy) => {
            if (!address) throw new Error('Wallet not connected')
            const result = await handleAuctionBuy(params)
            if (!result) throw new Error('No transaction response')
            return result as unknown as AuctionTxResult
        },
        onSuccess: (tx, params) => {
            handleTransactionSuccess(tx, params.title)
        },
        onError: handleTransactionError,
        onSettled: () => {
            // Invalidate collateral auction events
            reactQueryClient.invalidateQueries({ queryKey: auctionQueryKeys.eventsBase })
            setTimeout(() => {
                popupsActions.setIsWaitingModalOpen(false)
                popupsActions.setWaitingPayload({ status: ActionState.NONE })
            }, 2000)
        },
    })

    /**
     * Claim won auction tokens.
     */
    const auctionClaim = useMutation({
        mutationKey: ['auctions', 'mut', 'claim'],
        mutationFn: async (params: IAuctionBid) => {
            if (!address) throw new Error('Wallet not connected')
            const result = await handleAuctionClaim(params)
            if (!result) throw new Error('No transaction response')
            return result as unknown as AuctionTxResult
        },
        onSuccess: (tx, params) => {
            handleTransactionSuccess(tx, params.title)
        },
        onError: handleTransactionError,
        onSettled: () => {
            reactQueryClient.invalidateQueries({ queryKey: auctionQueryKeys.eventsBase })
            setTimeout(() => {
                popupsActions.setIsWaitingModalOpen(false)
                popupsActions.setWaitingPayload({ status: ActionState.NONE })
            }, 2000)
        },
    })

    /**
     * Claim internal balance (COIN or PROTOCOL_TOKEN).
     */
    const auctionClaimInternalBalance = useMutation({
        mutationKey: ['auctions', 'mut', 'claimInternalBalance'],
        mutationFn: async (params: IClaimInternalBalance) => {
            if (!address) throw new Error('Wallet not connected')
            const result = await handleClaimInternalBalance(params)
            if (!result) throw new Error('No transaction response')
            return result as unknown as AuctionTxResult
        },
        onSuccess: (tx, params) => {
            handleTransactionSuccess(tx, params.title)
        },
        onError: handleTransactionError,
        onSettled: () => {
            setTimeout(() => {
                popupsActions.setIsWaitingModalOpen(false)
                popupsActions.setWaitingPayload({ status: ActionState.NONE })
            }, 2000)
        },
    })

    return {
        auctionBid,
        auctionBuy,
        auctionClaim,
        auctionClaimInternalBalance,
    }
}
