
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK, LIT_RPC } from "@lit-protocol/constants";
import * as ethers from "ethers";
import * as path from 'path';
import * as fs from 'fs/promises';
import 'dotenv/config';
import { createSessionSignatures } from "./session";

const epk = process.env.ETHEREUM_PRIVATE_KEY || "";

const main = async () => {

    if (!process.env.ETHEREUM_PRIVATE_KEY) {
        throw new Error('ETHEREUM_PRIVATE_KEY environment variable is not set');
    }

    // Read the action code
    const actionCode = await fs.readFile(
        path.join(process.cwd(), 'dist', 'main.js'),
        'utf-8'
    );
    
    // console.log("Action code:", actionCode);

    const litNodeClient = new LitNodeClient({
        litNetwork: LIT_NETWORK.DatilDev,
        debug: true
    });

    await litNodeClient.connect();
    const ethersWallet = new ethers.Wallet(
        epk,
        new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
    );

    const sessionSignatures = await createSessionSignatures(litNodeClient, ethersWallet);

    // Get authSig from session signatures
    // console.log('Session signatures:', JSON.stringify(sessionSignatures, null, 2));
    const nodeUrl = Object.keys(sessionSignatures)[0];
    const authSig = sessionSignatures[nodeUrl];

    try {
      const response = await litNodeClient.executeJs({
          sessionSigs: sessionSignatures,
          code: actionCode,
          // ipfsId: "QmQTwEWvftVse7dfo9yvBbwCHXiLXgwCCADQEEYdeJ6UAX",
          jsParams: { 
            safeAddress: "0x47e03A42C07a09faB017b2a1011284d28C88121D",
            publication: "0xf1d0159fab4bfb3011c24a9d8479d6699eb6c34b",
            stream_id: "kjzl6kcym7w8y918zjr4eubhn7rhhgbhxopo9ys7yx6l0xvqnxw09i40q1x3nel", //"kjzl6kcym7w8y7l4imoc7zve4gg6dkyd1is7chl0s3uwpufmzgdca31wzz6py0h",
            pkpPublicKey: "0446e606edce501f2237e50e23259cae9cc4bda02044f57ab5aeaa974fceb38cb2a3ed9c27c5f02cf09a8581583547cb1d3a27e94dfc725f0b7da1cc75d33ced2e"
          } 
      });

    } catch (error) {   
        console.error("Error deploying action:", error);
    }

  //  console.log("Ethers wallet:", await ethersWallet.getAddress());
    // console.log(sessionSignatures)
    //console.log(response);

}

main();