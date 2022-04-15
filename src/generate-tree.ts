import {MerkleTree} from 'merkletreejs';
import keccak256 from 'keccak256';
import {BigNumber, utils} from 'ethers';
import * as dotenv from "dotenv"; // Env vars
import fs from 'fs';

dotenv.config();

const hashLeaf = (entry: {index: number | BigNumber, account: string, amount: BigNumber}) => {
    return utils.solidityKeccak256(['uint256', 'address', 'uint256'], [entry.index, entry.account, entry.amount]);
}

const treeFromEntries = (entries: {twitter: string, address: string, amount: string}[]): {merkleRoot: string, claims: Object} => {
    const indexedEntries = entries.map((entry, index) => {
        const parsedAddress = utils.getAddress(entry.address);
        return {
            "index": index,
            "account": parsedAddress,
            "amount": BigNumber.from(entry.amount),
        }
    })

    const tree = new MerkleTree(indexedEntries.map(hashLeaf), keccak256);

    const claims = indexedEntries.reduce<{
        [address: string]: { index: number, amount: string, proof: string[]}
    }>((memo, entry) => {
        memo[entry.account] = {
            index: entry.index,
            amount: entry.amount.toHexString(),
            proof: tree.getProof(hashLeaf(entry)).map((value) => '0x' + value.data.toString('hex'))
        };
        return memo;
    }, {})

    return {
        merkleRoot: tree.getHexRoot(),
        claims
    }
}

(async () => {
    const airdropFile: string = process.env.AIRDROP_FILE ?? "airdrop.jsonl";
    const proofsFile: string = process.env.PROOFS_FILE ?? "proofs.json";

    const entries: any[] = [];
    fs.readFileSync(airdropFile, { encoding: 'utf8' }).split(/\n/).map(line => {
        if (line) entries.push(JSON.parse(line));
    });

    const proofs = treeFromEntries(entries);

    console.log(proofs);

    fs.writeFileSync(proofsFile, JSON.stringify(proofs));
})();

