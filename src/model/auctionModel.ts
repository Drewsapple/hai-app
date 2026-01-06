import { type Action, type Thunk, action, thunk } from 'easy-peasy'

import {
    type AuctionData,
    type CollateralAuctionsData,
    Geb,
    type ICollateralAuction,
    fetchAuctionData,
    fetchCollateralAuctionData,
} from '@hai-on-op/sdk'

import type { IAuction, AuctionEventType, LoadingAuctionsData } from '~/types/auctions'
import { COLLATERAL_BATCH_SIZE, DEBT_BATCH_SIZE, SURPLUS_BATCH_SIZE } from '~/utils/constants'
import { type StoreModel } from './index'

export interface AuctionModel {
    fetchAuctions: Thunk<
        AuctionModel,
        {
            geb: Geb
            type: AuctionEventType
            tokenSymbol?: string
            startBlock?: number
            loadedAuctions?: any[]
            loadingAuctionsData?: LoadingAuctionsData
            userProxy?: string
        }
    >

    auctionsData: AuctionData | null
    setAuctionsData: Action<AuctionModel, AuctionData>
    fetchAuctionsData: Thunk<AuctionModel, { geb: Geb; proxyAddress: string }, StoreModel>
    loadingAuctionsData: LoadingAuctionsData
    setLoadingAuctionsData: Action<AuctionModel, LoadingAuctionsData>

    collateralData: CollateralAuctionsData[] | null
    setCollateralData: Action<AuctionModel, CollateralAuctionsData[]>
    fetchCollateralData: Thunk<
        AuctionModel,
        {
            geb: Geb
            collateral: string
            auctionIds: string[]
        },
        CollateralAuctionsData[]
    >

    // protInternalBalance = user's KITE balance in the protocol
    protInternalBalance: string
    setProtInternalBalance: Action<AuctionModel, string>

    // internalbalance = user's HAI balance in the protocol
    internalBalance: string
    setInternalBalance: Action<AuctionModel, string>

    coinBalances: {
        hai: string
        kite: string
    }
    setCoinBalances: Action<
        AuctionModel,
        {
            hai: string
            kite: string
        }
    >

    selectedAuction: IAuction | null
    setSelectedAuction: Action<AuctionModel, IAuction | null>
    selectedCollateralAuction: ICollateralAuction | null
    setSelectedCollateralAuction: Action<AuctionModel, ICollateralAuction | null>

    amount: string
    setAmount: Action<AuctionModel, string>

    collateralAmount: string
    setCollateralAmount: Action<AuctionModel, string>
}

export const auctionModel: AuctionModel = {
    fetchAuctions: thunk(async (actions) => {
        actions.setLoadingAuctionsData({ loading: true })
        actions.setLoadingAuctionsData({ loading: false })
    }),

    auctionsData: null,
    setAuctionsData: action((state, payload) => {
        state.auctionsData = payload
    }),
    fetchAuctionsData: thunk(async (actions, { geb, proxyAddress }) => {
        const fetched = await fetchAuctionData(geb, proxyAddress)
        if (fetched) {
            actions.setAuctionsData(fetched)
        }
    }),
    loadingAuctionsData: {
        loading: false,
    },
    setLoadingAuctionsData: action((state, payload) => {
        state.loadingAuctionsData = { ...state.loadingAuctionsData, ...payload }
    }),

    collateralData: null,
    setCollateralData: action((state, payload) => {
        state.collateralData = payload
    }),
    fetchCollateralData: thunk(async (state, { geb, collateral, auctionIds }) => {
        const fetched = await fetchCollateralAuctionData(geb, collateral, auctionIds)
        state.setCollateralData(fetched)
    }),

    protInternalBalance: '',
    setProtInternalBalance: action((state, payload) => {
        state.protInternalBalance = payload
    }),

    internalBalance: '',
    setInternalBalance: action((state, payload) => {
        state.internalBalance = payload
    }),

    coinBalances: {
        hai: '',
        kite: '',
    },
    setCoinBalances: action((state, payload) => {
        state.coinBalances = payload
    }),

    selectedAuction: null,
    setSelectedAuction: action((state, payload) => {
        state.selectedAuction = payload
    }),

    selectedCollateralAuction: null,
    setSelectedCollateralAuction: action((state, payload) => {
        state.selectedCollateralAuction = payload
    }),

    amount: '',
    setAmount: action((state, payload) => {
        state.amount = payload
    }),

    collateralAmount: '',
    setCollateralAmount: action((state, payload) => {
        state.collateralAmount = payload
    }),
}
