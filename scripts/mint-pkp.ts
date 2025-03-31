import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { AuthMethodType, AuthMethodScope, LIT_NETWORK } from '@lit-protocol/constants';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function mintPkp() {
    try {
        const litNodeClient = new LitJsSdk.LitNodeClient({
            litNetwork: LIT_NETWORK.DatilDev,
            debug: false
        });
        await litNodeClient.connect();

        // Define the auth method scope - which addresses can use this PKP for signing
        const authMethodScopes = [AuthMethodScope.SignAnything];

        // Create the SIWE auth method - this will allow specific addresses to use the PKP
        const authMethod = {
            authMethodType: AuthMethodType.AddressWhitelist,
            accessToken: JSON.stringify({
                allowedAddresses: [
                    process.env.ALLOWED_ADDRESS_1,
                    process.env.ALLOWED_ADDRESS_2,
                    // Add more addresses as needed
                ]
            })
        };

        // Mint the PKP with our auth method
        const mintTx = await litNodeClient.mintPKPWithAuthMethod({
            authMethod,
            authMethodScopes,
            sendPkpToitself: false
        });

        console.log("PKP Minting Transaction:", mintTx);

        // Get the PKP details
        const pkp = await litNodeClient.getPKP(mintTx.tokenId);
        
        console.log("\nPKP Details:");
        console.log("Token ID:", mintTx.tokenId);
        console.log("Public Key:", pkp.publicKey);
        console.log("ETH Address:", ethers.utils.computeAddress(pkp.publicKey));

        // Save these values to use in your .env file
        console.log("\nAdd these to your .env file:");
        console.log(`SIGNING_PKP_PUBLIC_KEY=${pkp.publicKey}`);
        console.log(`SIGNING_PKP_TOKEN_ID=${mintTx.tokenId}`);

    } catch (err) {
        console.error("Error minting PKP:", err);
    }
}

mintPkp();
