# native-rate-keeper

Hero upgrade, reset skill and reset skin are paid in BNB / POL straight to the contract, priced as
`BCOIN cost × 5 × HeroDesign.nativeRate`. This daily job moves `nativeRate` to the current BCOIN /
native price so those actions stay pegged to BCOIN.

Once a day (`NATIVE_RATE_CRON`, UTC) it reads prices from `ap-blockchain /coins_price`, reads the
on-chain rate through `ap-blockchain-center`, and per network:

| Change vs on-chain rate | Action |
|---|---|
| under 5% either way | nothing |
| rise of 5% or more | set (Slack when 25% or more) |
| drop of 5% to 25% | set |
| drop of 25% or more | not set, Slack |
| on-chain rate is 0 | nothing (features closed) |

The tx is signed locally and sent through `ap-blockchain-center /sendRawTransaction`. Every run
also posts to Slack when the keeper holds less than 0.0005 BNB or 0.05 POL. Errors are
only logged (`docker logs`).

The keeper wallet needs `DESIGNER_ROLE` on both `HeroDesign` proxies and a little BNB / POL for gas.

## Run

```sh
cp .env.example .env
npm install
npm start                                       # one run, local
docker exec <container> /app/run.sh             # one run, deployed (also in docker logs)
```

Start with `DRY_RUN=true`: it goes as far as `estimateGas`, so a missing role shows up without
sending anything.
