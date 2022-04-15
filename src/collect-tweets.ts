import Scraper from "./scraper"; // Scraper
import * as dotenv from "dotenv"; // Env vars
import { logger } from "./logger"; // Logging

// Setup env
dotenv.config();

(async () => {
  // Collect environment variables
  const conversationID: string | undefined = process.env.CONVERSATION_ID;
  const twitterBearer: string | undefined = process.env.TWITTER_BEARER;
  const pageLimit: number = Number(process.env.PAGE_LIMIT) ?? 0;
  const numTokens: number = Number(process.env.NUM_TOKENS) ?? 0;
  const rpcProvider: string | undefined = process.env.RPC_PROVIDER;

  // If no conversation id or twitter token provided
  if (!conversationID || !twitterBearer) {
    // Throw error and exit
    logger.error("Missing required parameters, update .env");
    process.exit(1);
  }

  // Scrape tweets for addresses
  const scraper = new Scraper(
    conversationID,
    twitterBearer,
    pageLimit,
    numTokens,
    rpcProvider
  );
  await scraper.scrape();
})();
