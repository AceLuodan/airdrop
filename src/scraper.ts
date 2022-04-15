import * as fs from "fs"; // Filesystem
import axios from "axios"; // Requests
import { logger } from "./logger"; // Logging
import { ethers, providers } from "ethers"; // Ethers

// Regex matches for addresses and ENS names
// const addressRegex: RegExp = /(0x[a-zA-Z0-9])\w+/;
const ENSRegex: RegExp = /([^ ]+\.(eth))/i;

export default class Scraper {
    // Optional RPC to resolve ENS names to addresses
    rpc?: providers.JsonRpcProvider | null;
    // Tweet conversation ID
    conversationID: string;
    // Twitter token
    twitterBearer: string;
    // Limit of page results to scrape
    pageLimit: number;
    // Number of tokens to distribute per address
    numTokens: number;

    // Collected tweets from Twitter API
    tweets: { id: string; text: string; author_id: string; author_username: string }[] = [];
    retweeters: Map<string, string> = new Map();
    // Cleaned addresses from tweets
    entries: { twitter: string, address: string }[] = [];

    /**
     * Setup scraper
     * @param {string} conversationID to scrape
     * @param {string} twitterBearer 2.0 token
     * @param {number} numTokens to distribute per address
     * @param {string?} rpcProvider optional rpc endpoint to convert ENS names
     */
    constructor(
        conversationID: string,
        twitterBearer: string,
        pageLimit: number,
        numTokens: number,
        rpcProvider?: string
    ) {
        this.conversationID = conversationID;
        this.twitterBearer = twitterBearer;
        this.pageLimit = pageLimit;
        this.numTokens = numTokens;

        if (rpcProvider) {
            this.rpc = new providers.JsonRpcProvider(rpcProvider);
        }
    }

    /**
     * Generates endpoint to query for tweets from a thread
     * @param {string?} nextToken if paginating tweets
     * @returns {string} endpoint url
     */
    generateConversationEndpoint(conversationID: string, nextToken?: string): string {
        const baseEndpoint: string =
            "https://api.twitter.com/2/tweets/search/recent?" +
            // Append conversation ID
            `query=conversation_id:${conversationID}` +
            // Collect max allowed results
            "&max_results=100" +
            // Add author data
            "&expansions=author_id";

        // If paginating, append next_token to endpoint
        return nextToken ? `${baseEndpoint}&next_token=${nextToken}` : baseEndpoint;
    }

    generateRetweetsEndpoint(conversationID: string, nextToken?: string): string {
        const baseEndpoint: string =
            `https://api.twitter.com/2/tweets/${conversationID}/retweeted_by?` +
            // Collect max allowed results
            "max_results=100";
        return nextToken ? `${baseEndpoint}&pagination_token=${nextToken}` : baseEndpoint;
    }

    generateQuotesEndpoint(conversationID: string, nextToken?: string): string {
        const baseEndpoint: string =
            `https://api.twitter.com/2/tweets/${conversationID}/quote_tweets?` +
            // Collect max allowed results
            "max_results=100" +
            // Add author data
            "&expansions=author_id";
        return nextToken ? `${baseEndpoint}&pagination_token=${nextToken}` : baseEndpoint;
    }

    /**
     * Recursively collect tweets from a thread (max. 100 per run)
     * @param {string?} nextSearchToken optional pagination token
     */
    async collectTweets(
        endpointGenerator: (conversationID: string, token: string | undefined) => string,
        nextSearchToken?: string,
        page?: number,
    ): Promise<void> {
        // Collect tweets
        const response = await axios({
            method: "GET",
            url: endpointGenerator(this.conversationID, nextSearchToken),
            headers: {
                Authorization: `Bearer ${this.twitterBearer}`
            }
        });

        // Map users
        const users = new Map();
        response.data.includes.users.map((userdata: any) => {
            users.set(userdata.id, userdata.username)
        });

        // Append new tweets
        const tweets: { id: string; text: string; author_id: string; author_username: string }[] = response.data.data?.map(
            (tweet: any) => {
                const username = users.get(tweet.author_id);
                return {
                    "id": tweet.id,
                    "text": tweet.text,
                    "author_id": tweet.author_id,
                    "author_username": username
                }
            }
        );

        this.tweets.push(...tweets);
        logger.info(`Collected ${this.tweets.length}`);

        const nextToken: string | undefined = response.data.meta.next_token;
        const nextPage: number = page ? page : 1;
        // If pagination token exists and still not reached the limit of entries:
        if (nextToken && this.pageLimit ? nextPage < this.pageLimit : true) {
            // Collect next page of tweets
            await this.collectTweets(endpointGenerator, nextToken);
        }
    }

    async collectRetweeters(nextSearchToken?: string): Promise<void> {
        const response = await axios({
            method: "GET",
            url: this.generateRetweetsEndpoint(this.conversationID, nextSearchToken),
            headers: {
                Authorization: `Bearer ${this.twitterBearer}`
            }
        });

        response.data.data?.map((user: any) => {
            this.retweeters.set(user.id, user.username);
        });
        logger.info(`Collected ${this.retweeters.size} retweets`);

        const nextToken: string | undefined = response.data.meta.next_token;
        if (nextToken) {
            // Collect next page of retweeters
            await this.collectRetweeters(nextToken);
        }
    }

    async collectTweetResponses(): Promise<void> {
        await this.collectTweets(this.generateConversationEndpoint);
    }

    async collectTweetQuotes(): Promise<void> {
        await this.collectTweets(this.generateQuotesEndpoint);
    }

    /*
     * Filter tweets from users that have retweeted
     */
    async filterByRetweets(): Promise<void> {
        await this.collectRetweeters();
        const filteredTweets = this.tweets.filter(tweet => this.retweeters.has(tweet.author_id));
        this.tweets = filteredTweets;
    }

    filterDuplicatedEntriesByAuthor(): void {
        const usernames: string[] = [];
        const filteredEntries = this.entries.filter(entry => {
            if (!usernames.includes(entry.twitter)) {
                usernames.push(entry.twitter);
                return true;
            }
            return false;
        })
        this.entries = filteredEntries;
    }

    filterDuplicatedEntriesByAddress(): void {
        const addresses: string[] = [];
        const filteredEntries = this.entries.filter(entry => {
            if (!addresses.includes(entry.address)) {
                addresses.push(entry.address);
                return true;
            }
            return false;
        })
        this.entries = filteredEntries;
    }

    /**
     * Cleans individual tweets, filtering for addresses
     */
    cleanTweetsForAddresses(): void {
        for (const tweet of this.tweets) {
            // Remove line-breaks, etc.
            const cleanedText: string = tweet.text.replace(/(\r\n|\n|\r)/gm, "");

            // const foundAddress: RegExpMatchArray | null =
            // cleanedText.match(addressRegex);
            const foundENS: RegExpMatchArray | null = cleanedText.match(ENSRegex);

            // for (const foundArrs of [foundAddress, foundENS]) {
            for (const foundArrs of [foundENS]) {
                // If match in tweet
                if (foundArrs && foundArrs.length > 0) {
                    // If type(address)
                    const addr: string = foundArrs[0].startsWith("0x")
                        ? // Quick cleaning to only grab first 42 characters
                        foundArrs[0].substring(0, 42)
                        : foundArrs[0];

                    // Push address or ENS name
                    this.entries.push(
                        {
                            "twitter": tweet.author_username,
                            "address": addr,
                        }
                    );
                }
            }
        }
    }

    /**
     * Checks if an address is valid
     * @param {string} address to check
     * @returns {{valid: boolean, address: string}} returns validity and checksum address
     */
    isValidAddress(address: string): { valid: boolean; address: string } {
        // Setup address
        let addr: string = address;

        try {
            // Return valid and address if success
            addr = ethers.utils.getAddress(address);
            return { valid: true, address: addr };
        } catch {
            // Else, if error
            return { valid: false, address };
        }
    }

    /**
     * Convert ENS names to addresses
     */
    async convertENS(): Promise<void> {
        let processedEntries: { twitter: string, address: string}[] = [];

        for (let i = 0; i < this.entries.length; i++) {
            // Force lowercase (to avoid .ETH, .eth, .eTh matching)
            const entry = this.entries[i];
            const address = entry.address.toLowerCase();

            // If ENS name
            if (address.includes(".eth")) {
                // Resolve name via RPC
                const parsed: string | undefined = await this.rpc?.resolveName(address) || undefined;
                if (parsed) {
                    // If successful resolve, push name
                    entry.address = parsed
                    processedEntries.push(entry);
                }
            } else {
                // Else, check if valid address
                const { valid, address: addr } = this.isValidAddress(address);
                // If address is valid
                if (valid) {
                    // Push checksummed address
                    entry.address = addr;
                    processedEntries.push(entry);
                }
            }
            if (i % 10) console.log(`Processed ${processedEntries.length} entries`);
        }

        this.entries = processedEntries;
    }

    /**
     * Outputs batched, copyable addresses to /output directory
     * Effects: Modifies filesystem, adds output directory and text files
     */
    outputAddresses(): void {
        // Create /output folder if it doesnt exist
        const outputDir: string = "./output";
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        for (let i = 0; i < this.entries.length; i++) {
            // Batch file numbers by 100
            const fileNumber: number = Math.floor(i / 100);

            fs.appendFileSync(
                // Append to file-1...(numAddresses/100)
                `${outputDir}/batch-${fileNumber}.txt`,
                // "address, tokenAmount" per line
                `${JSON.stringify(this.entries[i])}\n`
            );
        }
    }

    /**
     * Scrape tweets, find addresses, output batch copyable disperse files
     */
    async scrape() {

        // Collect all tweets from thread
        logger.info("~~~ Collect tweet responses ~~~");
        await this.collectTweetResponses();
        logger.info(`Collected ${this.tweets.length} tweet responses`);

        await this.filterByRetweets();
        const tweetResponses: number = this.tweets.length;
        logger.info(`Filtered ${tweetResponses} tweet responses with retweet`);

        logger.info("~~~ Collect tweet quotes ~~~");
        await this.collectTweetQuotes();
        const tweetQuotes: number = this.tweets.length - tweetResponses;
        logger.info(`Collected ${tweetQuotes} tweet quotes`);

        logger.info("~~~ Collect address entries ~~~");
        // Clean tweets, finding addresses and ENS names
        this.cleanTweetsForAddresses();
        logger.info(`Collected ${this.entries.length} entries from tweets`);

        this.filterDuplicatedEntriesByAuthor();

        // If RPC provided
        if (this.rpc) {
            // Resolve ENS names to addresses
            await this.convertENS();
            logger.info("Converted ENS names to addresses");
        }

        this.filterDuplicatedEntriesByAddress();

        logger.info(`Collected ${this.entries.length} unique entries`);

        logger.info("~~~ Output entries ~~~");
        // Output addresses to filesystem
        this.outputAddresses();
        logger.info("Outputted entries in 100-entries batches to /output");
    }
}
