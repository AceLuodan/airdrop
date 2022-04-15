# Tweetdrop

Simple scripts to:
- Collect and clean Ethereum addresses and ENS names from replies to a Tweet.
- Generate a Merkle tree of claims based on the collected addresses.

Inspired by [Anish-Agnihotri/tweetdrop](https://github.com/Anish-Agnihotri/tweetdrop) and [Uniswap/merkle-distributor](https://github.com/Uniswap/merkle-distributor)

## Requirements

1. Twitter API V2 access (easy to apply for at [developer.twitter.com](https://developer.twitter.com)). You will need a V2 API Bearer Token.
2. Conversation ID for thread you'd like to scrape. This is the number after `/status/` in a tweets direct URL. For example, `1428089265641201665` for punk4156s tweet (`https://twitter.com/punk4156/status/1428089265641201665`). Because of Twitter API limitations, the thread must be less than 7 days old.
3. Optional: If you'd like to resolve ENS names to addresses (necessary for airdrop), an Ethereum RPC url.

## Steps

1. Copy .env.sample to .env and fill out environment variables
```bash
cp .env.sample .env
```

2. Install dependencies
```bash
yarn install
```

3. Run scripts
```bash
yarn  collect-tweets
yarn compile-airdrop
yarn generate-tree
```
