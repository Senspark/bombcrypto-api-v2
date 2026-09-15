import {describe, expect, it} from 'vitest';
import LeaderBoardController from '../LeaderBoardController';
import RealtimeIndex from '../RealtimeIndex';

const logger = new Proxy({}, {get: () => () => undefined}) as any;

function entry(raceId: number, heroId: number, ticketCount = 1) {
    return {
        raceId,
        uid: heroId,
        userName: `player_${heroId}`,
        heroId,
        stakeBcoin: 100,
        stakeSen: 0,
        ticketCount,
        poolIndex: 0,
        network: 0,
        heroType: 0,
    };
}

function setup() {
    let onMessage: (data: any) => void = () => undefined;
    let updates = 0;
    const messenger = {
        subscribe: (_channel: string, cb: (data: any) => void) => {
            onMessage = cb;
        },
    };
    const board = new LeaderBoardController(logger, messenger, new RealtimeIndex(), () => updates++);
    return {
        heroes: () => board.exportData().flat(),
        heroIds: () => board.exportData().flat().map(h => h.heroId),
        updates: () => updates,
        publish: (data: any) => onMessage(data),
    };
}

describe('LeaderBoardController', () => {
    it('does not clear the board when a late entry from an older race arrives', () => {
        const {heroIds, publish} = setup();

        publish([entry(6, 1)]);
        publish([entry(5, 2)]);

        expect(heroIds()).toEqual([1]);
    });

    it('keeps the last entry of a hero within a batch', () => {
        const {heroes, publish} = setup();

        publish([entry(7, 1, 3), entry(7, 1, 9)]);

        expect(heroes().map(h => h.ticketCount)).toEqual([9]);
    });

    it('clears the board when a newer race starts inside a batch', () => {
        const {heroIds, publish} = setup();

        publish([entry(5, 1)]);
        publish([entry(5, 2), entry(6, 3)]);

        expect(heroIds()).toEqual([3]);
    });

    it('notifies once per batch', () => {
        const {updates, publish} = setup();

        publish([entry(7, 1), entry(7, 2), entry(7, 3)]);

        expect(updates()).toBe(1);
    });

    it('ignores a payload that is not an array', () => {
        const {heroIds, updates, publish} = setup();

        publish(entry(7, 1));

        expect(heroIds()).toEqual([]);
        expect(updates()).toBe(0);
    });
});
