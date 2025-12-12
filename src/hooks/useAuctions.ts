import { useEffect, useMemo, useState } from 'react'
import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { radToFixed, wadToFixed } from '@hai-on-op/sdk'
import { useAccount, useBlockNumber, useContractRead, usePublicClient } from 'wagmi'
import { getAbiItem, type Address } from 'viem'

import type { AuctionEventType, IAuction, IAuctionBid } from '~/types'
import { ActionState, formatSurplusAndDebtAuctions, getAuctionStatus, Status } from '~/utils'
import { useStoreActions, useStoreState } from '~/store'
import { usePublicGeb, useGeb } from './useGeb'
import { useInfiniteQuery } from '@tanstack/react-query'
import IDebtAuctionHouse from '~/abis/IDebtAuctionHouse'
import ISurplusAuctionHouse from '~/abis/ISurplusAuctionHouse'
import ICollateralAuctionHouse from '~/abis/ICollateralAuctionHouse'

const BLOCK_INTERVAL = 1_000_000_000_000
const START_BLOCK = 1

type PageParam = {
    fromBlock: number
    toBlock: number
}

const initialPageParam: PageParam = {
    fromBlock: START_BLOCK,
    toBlock: START_BLOCK + BLOCK_INTERVAL,
}

export function useAuctionEvents<AuctionType extends AuctionEventType>(
    type?: AuctionType,
    tokenSymbol?: AuctionType extends 'COLLATERAL' ? string : never
) {
    const geb = usePublicGeb()

    const publicClient = usePublicClient({ chainId: 10 })

    const { data: latestBlock } = useBlockNumber({ chainId: 10, staleTime: 60_000 })

    const { data: surplusParams } = useContractRead({
        abi: ISurplusAuctionHouse,
        address: geb.contracts.surplusAuctionHouse.address as Address,
        functionName: 'params',
    })

    const { data: debtParams } = useContractRead({
        abi: IDebtAuctionHouse,
        address: geb.contracts.debtAuctionHouse.address as Address,
        functionName: 'params',
    })

    const surplusRaw = useInfiniteQuery({
        queryKey: ['surplusAuctionStarts'],
        queryFn: async ({ pageParam: { fromBlock, toBlock } = initialPageParam }: { pageParam?: PageParam }) => {
            const data = await publicClient.getLogs({
                address: geb.contracts.surplusAuctionHouse.address as Address,
                events: (['StartAuction', 'IncreaseBidSize', 'RestartAuction', 'SettleAuction'] as const).map(
                    (eventName) =>
                        getAbiItem({
                            abi: ISurplusAuctionHouse,
                            name: eventName,
                        })
                ),
                strict: true,
                fromBlock: BigInt(fromBlock),
                toBlock: BigInt(toBlock),
            })

            return {
                data,
                fromBlock,
                toBlock: data.length
                    ? Number(data[data.length - 1].blockNumber)
                    : Math.min(toBlock, Number(latestBlock ?? fromBlock)),
            }
        },
        getNextPageParam: (lastPage: PageParam) => ({
            fromBlock: lastPage.toBlock + 1,
            toBlock: lastPage.toBlock + BLOCK_INTERVAL,
        }),
        getPreviousPageParam: (firstPage: PageParam) => {
            if (firstPage.fromBlock === START_BLOCK) return undefined
            return {
                fromBlock: Math.max(START_BLOCK, firstPage.fromBlock - BLOCK_INTERVAL),
                toBlock: firstPage.fromBlock - 1,
            }
        },
        enabled: latestBlock !== undefined && (type === 'SURPLUS' || type === undefined),
    })

    const surplus = useMemo(() => {
        if (surplusRaw.data === undefined) return { ...surplusRaw, data: undefined }

        const all = surplusRaw.data.pages.flatMap(({ data }) => data)

        const data = formatSurplusAndDebtAuctions(
            all
                .filter((log) => log.eventName === 'StartAuction')
                .map(({ args, transactionHash }) => {
                    const isClaimed = all.some(
                        ({ eventName, args: settledArgs }) =>
                            eventName === 'SettleAuction' && settledArgs._id === args._id
                    )

                    const auctionDeadline = (
                        all
                            .filter((log) => log.eventName === 'RestartAuction')
                            .findLast(({ args: restartArgs }) => restartArgs._id === args._id)?.args._auctionDeadline ??
                        args._auctionDeadline
                    ).toString()

                    const auction = {
                        auctionId: args._id.toString(),
                        auctioneer: args._auctioneer,
                        createdAt: args._blockTimestamp?.toString(),
                        createdAtTransaction: transactionHash,
                        amount: args._amountToSell.toString(),
                        initialBid: args._amountToRaise.toString(),
                        isClaimed,
                        auctionDeadline,
                        biddersList: all
                            .filter((log) => log.eventName === 'IncreaseBidSize')
                            .filter(({ args: buyArgs }) => buyArgs._id === args._id)
                            .map(({ args, transactionHash }) => ({
                                bidder: args._bidder,
                                bid: args._raisedAmount.toString(),
                                createdAt: args._blockTimestamp.toString(),
                                buyAmount: args._soldAmount.toString(),
                                createdAtTransaction: transactionHash,
                            })),
                        englishAuctionType: 'SURPLUS',
                        sellToken: 'COIN',
                        buyToken: 'PROTOCOL_TOKEN',
                    } as const

                    return {
                        ...auction,
                        status: getAuctionStatus(auction, {
                            debt: Infinity,
                            surplus: Number(surplusParams?.bidDuration ?? Infinity),
                        }),
                    }
                })
        )

        return { ...surplusRaw, data }
    }, [surplusRaw, surplusParams])

    const debtRaw = useInfiniteQuery({
        queryKey: ['debtAuctionStarts'],
        queryFn: async ({ pageParam: { fromBlock, toBlock } = initialPageParam }: { pageParam?: PageParam }) => {
            const data = await publicClient.getLogs({
                address: geb.contracts.debtAuctionHouse.address as Address,
                events: (['StartAuction', 'DecreaseSoldAmount', 'RestartAuction', 'SettleAuction'] as const).map(
                    (eventName) =>
                        getAbiItem({
                            abi: IDebtAuctionHouse,
                            name: eventName,
                        })
                ),
                strict: true,
                fromBlock: BigInt(fromBlock),
                toBlock: BigInt(toBlock),
            })
            return {
                data,
                fromBlock,
                toBlock: data.length
                    ? Number(data[data.length - 1].blockNumber)
                    : Math.min(toBlock, Number(latestBlock ?? fromBlock)),
            }
        },
        getNextPageParam: (lastPage: PageParam) => ({
            fromBlock: lastPage.toBlock + 1,
            toBlock: lastPage.toBlock + BLOCK_INTERVAL,
        }),
        getPreviousPageParam: (firstPage: PageParam) => {
            if (firstPage.fromBlock === START_BLOCK) return undefined
            return {
                fromBlock: Math.max(START_BLOCK, firstPage.fromBlock - BLOCK_INTERVAL),
                toBlock: firstPage.fromBlock - 1,
            }
        },
        enabled: latestBlock !== undefined && (type === 'DEBT' || type === undefined),
    })

    const debt = useMemo(() => {
        if (debtRaw.data === undefined) return { ...debtRaw, data: undefined }

        const all = debtRaw.data.pages.flatMap(({ data }) => data)

        const data = formatSurplusAndDebtAuctions(
            all
                .filter((log) => log.eventName === 'StartAuction')
                .map(({ args, transactionHash }) => {
                    const isClaimed = all.some(
                        ({ eventName, args: settledArgs }) =>
                            eventName === 'SettleAuction' && settledArgs._id === args._id
                    )

                    const auctionDeadline = (
                        all
                            .filter((log) => log.eventName === 'RestartAuction')
                            .findLast(({ args: restartArgs }) => restartArgs._id === args._id)?.args._auctionDeadline ??
                        args._auctionDeadline
                    ).toString()

                    const auction = {
                        auctionId: args._id.toString(),
                        auctioneer: args._auctioneer,
                        createdAt: args._blockTimestamp?.toString(),
                        createdAtTransaction: transactionHash,
                        initialBid: args._amountToRaise.toString(),
                        amount: args._amountToSell.toString(),
                        auctionDeadline,
                        isClaimed,
                        biddersList: all
                            .filter((log) => log.eventName === 'DecreaseSoldAmount')
                            .filter(({ args: buyArgs }) => buyArgs._id === args._id)
                            .map(({ args, transactionHash }) => ({
                                bidder: args._bidder,
                                bid: args._soldAmount.toString(),
                                createdAt: args._blockTimestamp.toString(),
                                buyAmount: args._raisedAmount.toString(),
                                createdAtTransaction: transactionHash,
                            })),
                        englishAuctionType: 'DEBT',
                        sellToken: 'PROTOCOL_TOKEN',
                        buyToken: 'COIN',
                    } as const

                    return {
                        ...auction,
                        status: getAuctionStatus(auction, {
                            surplus: Infinity,
                            debt: Number(debtParams?.bidDuration ?? Infinity),
                        }),
                    }
                })
        )

        return { ...debtRaw, data }
    }, [debtRaw, debtParams])

    const collateralAuctionHouses = useMemo(
        () =>
            Object.values(geb.tokenList)
                .filter(
                    ({ symbol, isCollateral }) => isCollateral && (tokenSymbol === undefined || tokenSymbol === symbol)
                )
                .map(({ symbol, collateralAuctionHouse }) => ({
                    symbol,
                    collateralAuctionHouse: collateralAuctionHouse as Address,
                })),
        [geb.tokenList, tokenSymbol]
    )

    const collateralRaw = useInfiniteQuery({
        queryKey: ['collateralAuctionStarts', tokenSymbol],
        queryFn: async ({ pageParam: { fromBlock, toBlock } = initialPageParam }: { pageParam?: PageParam }) => {
            const data = await publicClient.getLogs({
                address: collateralAuctionHouses.map(({ collateralAuctionHouse }) => collateralAuctionHouse),
                events: (['StartAuction', 'BuyCollateral', 'SettleAuction'] as const).map((eventName) =>
                    getAbiItem({
                        abi: ICollateralAuctionHouse,
                        name: eventName,
                    })
                ),
                strict: true,
                fromBlock: BigInt(fromBlock),
                toBlock: BigInt(toBlock),
            })

            return {
                data,
                fromBlock,
                toBlock: data.length
                    ? Number(data[data.length - 1].blockNumber)
                    : Math.min(toBlock, Number(latestBlock ?? fromBlock)),
            }
        },
        getNextPageParam: (lastPage: PageParam) => ({
            fromBlock: lastPage.toBlock + 1,
            toBlock: lastPage.toBlock + BLOCK_INTERVAL,
        }),
        getPreviousPageParam: (firstPage: PageParam) => {
            if (firstPage.fromBlock === START_BLOCK) return undefined
            return {
                fromBlock: Math.max(START_BLOCK, firstPage.fromBlock - BLOCK_INTERVAL),
                toBlock: firstPage.fromBlock - 1,
            }
        },
        enabled: latestBlock !== undefined && (type === 'COLLATERAL' || type === undefined),
    })

    const collateral = useMemo(() => {
        if (collateralRaw.data === undefined) return { ...collateralRaw, data: undefined }

        const all = collateralRaw.data.pages.flatMap(({ data }) => data)

        const data = all
            .filter((log) => log.eventName === 'StartAuction')
            .map(({ args, transactionHash, address }) => {
                const settlement = all.find(
                    ({ eventName, args: settledArgs, address: settledAddress }) =>
                        eventName === 'SettleAuction' && settledArgs._id === args._id && address === settledAddress
                )
                const auctioneer = args._auctioneer
                const amountToSell = args._amountToSell.toString()
                const amountToRaise = args._amountToRaise.toString()
                const createdAt = args._blockTimestamp?.toString()
                const createdAtTransaction = transactionHash

                const biddersList = all
                    .filter((log) => log.eventName === 'BuyCollateral')
                    .filter(
                        ({ args: buyArgs, address: buyAddress }) => buyArgs._id === args._id && address === buyAddress
                    )
                    .map(({ args, transactionHash }) => ({
                        bidder: args._bidder,
                        bid: args._soldAmount.toString(),
                        createdAt: args._blockTimestamp.toString(),
                        buyAmount: args._raisedAmount.toString(),
                        sellAmount: args._soldAmount.toString(),
                        createdAtTransaction: transactionHash,
                    }))

                const collateralBought = biddersList.reduce(
                    (accumulated, bid) => accumulated.add(bid.bid),
                    BigNumber.from('0')
                )

                const raised = biddersList.reduce(
                    (accumulated, bid) => accumulated.add(bid.buyAmount),
                    BigNumber.from('0')
                )

                const kickBidder = {
                    bidder: auctioneer,
                    buyAmount: '0',
                    sellAmount: '0',
                    createdAt,
                    bid: '0',
                    createdAtTransaction,
                }

                const initialBids = [...[kickBidder], ...biddersList].map((bid) => ({
                    ...bid,
                    buyAmount: formatEther(bid.buyAmount),
                    sellAmount: formatEther(bid.sellAmount),
                }))

                const auction = {
                    auctionId: args._id.toString(),
                    // auctioneer,
                    createdAt,
                    createdAtTransaction,
                    // amountToSell,
                    // initialBid: args._amountToRaise.toString(),
                    // amountToRaise,
                    // amountToRaiseE18: utils.decimalShift(BigNumber.from(amountToRaise), floatsTypes.WAD - floatsTypes.RAD),
                    isClaimed: settlement !== undefined,
                    biddersList: initialBids,
                    sellAmount: formatEther(raised),
                    buyAmount: formatEther(collateralBought),
                    sellInitialAmount: formatEther(amountToSell),
                    buyInitialAmount: formatEther(amountToRaise),
                    startedBy: auctioneer,
                    // remainingToRaiseE18: remainingToRaiseE18Raw > '0' ? remainingToRaiseE18Raw : '0',
                    // remainingCollateral: BigNumber.from(amountToSell).sub(collateralBought).toString(),
                    tokenSymbol,
                    englishAuctionType: 'COLLATERAL',
                    englishAuctionBids: [] satisfies IAuctionBid[],
                    englishAuctionConfiguration: {
                        bidDuration: '',
                        bidIncrease: '',
                        totalAuctionLength: '',
                        DEBT_amountSoldIncrease: '',
                    },
                    sellToken: collateralAuctionHouses.find(
                        ({ collateralAuctionHouse }) => address.toLowerCase() === collateralAuctionHouse.toLowerCase()
                    )!.symbol,
                    buyToken: 'HAI',
                    auctionDeadline: '',
                    winner: '',
                } as const

                return {
                    ...auction,
                    status: getAuctionStatus(auction, {
                        debt: Infinity,
                        surplus: Infinity,
                    }),
                } as const satisfies IAuction
            })
        return { ...collateralRaw, data }
    }, [collateralRaw, tokenSymbol, collateralAuctionHouses])

    return {
        surplus,
        debt,
        collateral,
        surplusParams,
        debtParams,
    }
}

// start surplus auction
export function useStartAuction() {
    const {
        auctionModel: { auctionsData },
    } = useStoreState((state) => state)
    const {
        auctionModel: auctionActions,
        popupsModel: popupsActions,
        transactionsModel: transactionsActions,
    } = useStoreActions((actions) => actions)

    const { address: account } = useAccount()
    const geb = useGeb()

    const [data, setData] = useState({
        systemSurplus: '',
        systemDebt: '',
        surplusRequiredToAuction: {
            total: '',
            remaining: '',
        },
        debtRequiredToAuction: '',
        surplusAmountToSell: '',
        debtAmountToSell: '',
        protocolTokensOffered: '',
    })

    useEffect(() => {
        if (!auctionsData) return

        const { coinBalance, debtBalance, unqueuedUnauctionedDebt, accountingEngineParams } =
            auctionsData.accountingEngineData || {}
        const {
            surplusAmount,
            surplusBuffer,
            debtAuctionBidSize: debtAmountToSell,
            debtAuctionMintedTokens: protocolTokensOffered,
        } = accountingEngineParams

        const systemSurplus = coinBalance.sub(debtBalance)
        const systemDebt = unqueuedUnauctionedDebt.sub(coinBalance)

        const surplusRequiredToAuction = surplusAmount.add(surplusBuffer)

        const debtRequiredToAuction = debtAmountToSell.sub(systemDebt)

        setData({
            systemSurplus: radToFixed(systemSurplus.lt(0) ? BigNumber.from(0) : systemSurplus).toString(),
            systemDebt: radToFixed(systemDebt.lt(0) ? BigNumber.from(0) : systemDebt).toString(),
            surplusRequiredToAuction: {
                total: radToFixed(surplusRequiredToAuction).toString(),
                remaining: radToFixed(surplusRequiredToAuction.sub(systemSurplus)).toString(),
            },
            debtRequiredToAuction: radToFixed(debtRequiredToAuction).toString(),
            surplusAmountToSell: radToFixed(surplusAmount).toString(),
            debtAmountToSell: radToFixed(debtAmountToSell).toString(),
            protocolTokensOffered: wadToFixed(protocolTokensOffered).toString(),
        })
    }, [auctionsData])

    // Check surplus cooldown. Time now > lastSurplusTime + surplusDelay
    const surplusCooldownDone = useMemo(() => {
        if (!auctionsData?.accountingEngineData) return false

        const {
            lastSurplusTime,
            accountingEngineParams: { surplusDelay },
        } = auctionsData.accountingEngineData
        if (!lastSurplusTime || !surplusDelay) return false
        return new Date() > new Date(lastSurplusTime.add(surplusDelay).mul(1000).toNumber())
    }, [auctionsData?.accountingEngineData])

    // if delta to start surplus auction is negative and cooldown is over we can allow to start surplus auction
    const allowStartSurplusAuction = useMemo(() => {
        if (!data.surplusAmountToSell || !data.surplusRequiredToAuction) return false
        return data.surplusRequiredToAuction.remaining <= '0' && surplusCooldownDone
    }, [data.surplusAmountToSell, surplusCooldownDone, data.surplusRequiredToAuction])

    // if delta to start debt auction is negative we can allow to start surplus auction
    const allowStartDebtAuction = useMemo(() => {
        if (!data.debtAmountToSell || !data.debtRequiredToAuction) return false
        return data.debtRequiredToAuction <= '0'
    }, [data.debtAmountToSell, data.debtRequiredToAuction])

    const startSurplusAcution = async function () {
        if (!account) throw new Error('No library or account')

        const txResponse = await geb.contracts.accountingEngine.auctionSurplus()

        if (!txResponse) throw new Error('No transaction request!')

        const { hash, chainId } = txResponse
        transactionsActions.addTransaction({
            chainId,
            hash,
            from: txResponse.from,
            summary: 'Starting surplus auction',
            addedTime: new Date().getTime(),
            originalTx: txResponse,
        })
        popupsActions.setIsWaitingModalOpen(true)
        popupsActions.setWaitingPayload({
            title: 'Transaction Submitted',
            hash: txResponse.hash,
            status: ActionState.SUCCESS,
        })
        await txResponse.wait()
        auctionActions.fetchAuctions({
            geb,
            type: 'DEBT',
        })
        auctionActions.fetchAuctions({
            geb,
            type: 'SURPLUS',
        })
        popupsActions.setIsWaitingModalOpen(false)
        popupsActions.setWaitingPayload({ status: ActionState.NONE })
    }

    const startDebtAcution = async function () {
        if (!account) throw new Error('No library or account')

        const txResponse = await geb.contracts.accountingEngine.auctionDebt()

        if (!txResponse) throw new Error('No transaction request!')

        const { hash, chainId } = txResponse
        transactionsActions.addTransaction({
            chainId,
            hash,
            from: txResponse.from,
            summary: 'Starting debt auction',
            addedTime: new Date().getTime(),
            originalTx: txResponse,
        })
        popupsActions.setIsWaitingModalOpen(true)
        popupsActions.setWaitingPayload({
            title: 'Transaction Submitted',
            hash: txResponse.hash,
            status: ActionState.SUCCESS,
        })
        await txResponse.wait()
        auctionActions.fetchAuctions({
            geb,
            type: 'DEBT',
        })
        auctionActions.fetchAuctions({
            geb,
            type: 'SURPLUS',
        })
        popupsActions.setIsWaitingModalOpen(false)
        popupsActions.setWaitingPayload({ status: ActionState.NONE })
    }

    return {
        startSurplusAcution,
        startDebtAcution,
        ...data,
        allowStartSurplusAuction,
        allowStartDebtAuction,
        lastSurplusTime: auctionsData?.accountingEngineData.lastSurplusTime,
        surplusDelay: auctionsData?.accountingEngineData.accountingEngineParams.surplusDelay,
        surplusCooldownDone,
    }
}

export function useRestartAuction(auction: IAuction) {
    const { address: account } = useAccount()

    const {
        auctionModel: auctionActions,
        popupsModel: popupsActions,
        transactionsModel: transactionsActions,
    } = useStoreActions((actions) => actions)

    const geb = useGeb()

    const canRestart =
        !!account && !!geb && auction.englishAuctionType !== 'COLLATERAL' && auction.status === Status.RESTARTING

    const restartDebtOrSurplusAuction = async () => {
        if (!canRestart) return

        let txResponse: any
        switch (auction.englishAuctionType) {
            case 'DEBT':
                txResponse = await geb.contracts.debtAuctionHouse.restartAuction(auction.auctionId)
                break
            case 'SURPLUS':
                txResponse = await geb.contracts.surplusAuctionHouse.restartAuction(auction.auctionId)
                break
        }

        if (!txResponse) throw new Error('No transaction request!')

        const { hash, chainId } = txResponse
        transactionsActions.addTransaction({
            chainId,
            hash,
            from: txResponse.from,
            summary: `Restarting ${auction.englishAuctionType.toLowerCase()} auction`,
            addedTime: new Date().getTime(),
            originalTx: txResponse,
        })
        popupsActions.setIsWaitingModalOpen(true)
        popupsActions.setWaitingPayload({
            title: 'Transaction Submitted',
            hash: txResponse.hash,
            status: ActionState.SUCCESS,
        })
        await txResponse.wait()
        auctionActions.fetchAuctions({
            geb,
            type: 'DEBT',
        })
        auctionActions.fetchAuctions({
            geb,
            type: 'SURPLUS',
        })
        popupsActions.setIsWaitingModalOpen(false)
        popupsActions.setWaitingPayload({ status: ActionState.NONE })
    }

    return {
        canRestart,
        restartDebtOrSurplusAuction,
    }
}
