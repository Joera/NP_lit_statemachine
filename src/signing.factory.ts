import { ethers } from "ethers";
import { publicationAbi } from "./abi";

interface SigningParams {
    pkpPublicKey: string;  // The public key of the PKP that should sign
}

export const signUpdateHtmlRootTx = async (
    contractAddress: string, 
    htmlRoot: string,
    signingParams: SigningParams
) => {
    // Create contract interface
    const contract = new ethers.Contract(contractAddress, publicationAbi);
    
    // Create the unsigned transaction data
    const unsignedTx: any = await contract.populateTransaction.updateHtmlRoot(htmlRoot);
    
    // Get the transaction data to be signed
    const toSign = ethers.utils.arrayify(unsignedTx.data);

    // set access conditions here 

    const accessControlConditions = [
        {
          contractAddress: "0xYourSmartContractAddress",
          standardContractType: "Custom",
          chain: "ethereum",
          method: "isAuthorizedSigner",
          parameters: [userAddress], // User’s wallet address
          returnValueTest: {
            comparator: "=",
            value: "true", // Must return `true` to allow signing
          },
        },
      ];
  
      // Check if the user is allowed
      const hasAccess = await Lit.Actions.checkConditions({
        accessControlConditions,
        authSig: Lit.Actions.authSig, // User’s auth signature
        chain: "ethereum",
      });
  
      if (!hasAccess) {
        throw new Error("Access Denied: You are not authorized to sign.");
      }
    
    const signature = await Lit.Actions.signAndCombineEcdsa({
        toSign,
        sigName: "autonomous",
        publicKey: Lit.Actions.getSigningAddress() // Only need authSig, conditions are checked automatically
    });

    // Parse the signature
    const jsonSignature = JSON.parse(signature);
    jsonSignature.r = "0x" + jsonSignature.r;
    jsonSignature.s = "0x" + jsonSignature.s;
    const hexSignature = ethers.utils.joinSignature(jsonSignature);
    
    return {
        toSign,
        serializedTransaction: ethers.utils.serializeTransaction(
            unsignedTx,
            hexSignature
        )
    };
}