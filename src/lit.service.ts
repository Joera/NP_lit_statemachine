import { AUTH_METHOD_SCOPE, AUTH_METHOD_TYPE, LIT_NETWORK, LIT_RPC } from "@lit-protocol/constants";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { createSiweMessage, generateAuthSig } from "@lit-protocol/auth-helpers";
import { ethers } from "ethers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import * as siwe from "siwe";

export class LitService {

    client: any
    signer: any
    contract!: any
    authSig!: any
    sessionSigs!: any[]
    storage: any

    constructor(private_key: string) {

        this.signer = new ethers.Wallet(
            private_key,
            new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
        );

        this.client = new LitNodeClient({
            litNetwork: LIT_NETWORK.DatilDev,  // Use the testnet network
            debug: false,
            storageProvider: {
                provider: this.storage,
            }
        });

        this.contract = new LitContracts({
            signer: this.signer,
            network: LIT_NETWORK.Datil,
        });
    }

    async init() { 

        await this.client.connect();
        await this.contract.connect();
    }


    async __authSig(resourceAbilityRequests: any[]) {

        console.log(resourceAbilityRequests);

        const domain = 'localhost';
        const origin = `https://${domain}:3000`;
        const expirationTime = new Date(
            Date.now() + 1000 * 60 * 60 * 24 // 1 day
        ).toISOString();

        const walletAddress = await this.signer.getAddress();
        const chainId = 1; // Ethereum mainnet

        const statement = "I authorize this application to perform actions on my behalf";
        
        const toSign = await createSiweMessage({
            domain,
            uri: origin,
            version: '1',
            statement,
            expiration: expirationTime,
            resources: resourceAbilityRequests.map(r => r.resource),
            walletAddress,
            nonce: await this.client.getLatestBlockhash(),
            litNodeClient: this.client
        });
      
        return await generateAuthSig({
            signer: this.signer,
            toSign
        });
    }

    async sessionSignature(resourceAbilityRequests: { resource: { resource: string, resourcePrefix: string }, ability: string }[]) { 
        

        const authNeededCallback = async (params: any) => {
            return this.__authSig(resourceAbilityRequests);
        };

        this.sessionSigs = await this.client.getSessionSigs({
            chain: "ethereum",
            expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
            resourceAbilityRequests,
            authNeededCallback,
        });

        return this.sessionSigs;
    }

    // async executeJS(litActionCode: string) { 
    

    //     const response = await this.client.executeJs({
    //         sessionSigs: this.sessionSigs,
    //         code: litActionCode,
    //         jsParams: {
    //             magicNumber: 43,
    //         }
    //     });

    //     return response;
    // }

    async mintPKP(authSig: any) {

        const mintInfo = await this.contract.mintWithAuth({
            authMethod: {
                authMethodType: AUTH_METHOD_TYPE.EthWallet,
                accessToken: JSON.stringify(authSig),
            },
            scopes: [AUTH_METHOD_SCOPE.SignAnything],
        });

        console.log(mintInfo.pkp);
        return mintInfo;
    }
    
}