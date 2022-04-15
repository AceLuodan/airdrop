import fs from 'fs';
import path from 'path';
import * as dotenv from "dotenv"; // Env vars

dotenv.config();

(async () => {
    const numTokens: string = process.env.NUM_TOKENS ?? "10";
    const entriesDir: string = process.env.ENTRIES_DIR ?? "output";
    const airdropFile: string = process.env.AIRDROP_FILE ?? "airdrop.json";

    const files = fs.readdirSync(entriesDir);
    const entries: { twitter: string, address: string, amount: string }[] = [];
    files.map(file => fs.readFileSync(
        path.join(entriesDir, file), { encoding: 'utf8' })
        .split(/\n/)
        .map(line => {
            if (line) entries.push(JSON.parse(line));
        }));

    const formattedEntries = entries.map(
        entry => {
            return {
                "username": entry.twitter,
                "address": entry.address,
                "amount": numTokens
            }
        }
    );

    fs.writeFileSync(airdropFile, '');
    formattedEntries.map(entry => {
        fs.appendFileSync(airdropFile, `${JSON.stringify(entry)}\n`);
    });
})();
