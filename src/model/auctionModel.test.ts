import { createStore, EasyPeasyConfig, Store } from 'easy-peasy'
import { type AuctionModel, auctionModel } from './auctionModel'

describe('auction model', () => {
    let store: Store<AuctionModel, EasyPeasyConfig<{}, any>>
    beforeEach(() => {
        store = createStore(auctionModel)
    })

    describe('selectedAuction', () => {
        it('manages selected auction state', () => {
            expect(store.getState().selectedAuction).toBe(null)
        })
    })

    describe('form amounts', () => {
        it('manages amount state', () => {
            expect(store.getState().amount).toBe('')
            store.getActions().setAmount('100')
            expect(store.getState().amount).toBe('100')
        })

        it('manages collateralAmount state', () => {
            expect(store.getState().collateralAmount).toBe('')
            store.getActions().setCollateralAmount('50')
            expect(store.getState().collateralAmount).toBe('50')
        })
    })
})
