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

```bash
# 1. Copy .env.sample to .env and fill out environment variables
# NUM_TOKENS should be how many tokens you'd like to airdrop per address
cp .env.sample .env

# 2. Install dependencies
npm install

# 3. Run scripts
npm run collect-tweets
npm run compile-airdrop
npm run generate-tree
```
