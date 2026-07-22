const HOST = `/api`;
const PAY_ROCK_HOST = `/pay-rock-api`;

const Urls = {
    // @formatter:off
    ThFetchThModeLeaderBoard    : `${HOST}/th/leaderboard`,
    ThWatchWallet               : (wallet: string) => `${HOST}/th/watch/${encodeURIComponent(wallet)}`,

    PayRockPreview              : `${PAY_ROCK_HOST}/pay-rock/preview`,
    PayRockConfirm              : `${PAY_ROCK_HOST}/pay-rock/confirm`,
};

export default Urls;
