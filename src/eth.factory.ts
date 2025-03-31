import { publicationAbi } from "./abi";
import { ALCHEMY_KEY } from "./constants";

export const readConfig = async (contractAddress: string) => {
    try {
        const provider = new ethers.providers.JsonRpcProvider({
            url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
            name: 'base-sepolia',
            chainId: 84531
        });
        const code = await provider.getCode(contractAddress);
        if (code === "0x") {
            throw new Error(`No contract found at address ${contractAddress}`);
        }
        // console.log("Contract code exists at address");
        const contract = new ethers.Contract(
            contractAddress,
            publicationAbi,
            provider
        );
        // console.log("Attempting to call config()...");
        const configCid = await contract.getConfig();
        // console.log("Raw response:", configCid);
        if (!configCid || configCid === "0x") {
            throw new Error("Config returned empty value");
        }
        // console.log("Retrieved config:", configCid);
        return configCid;
    } catch (error) {
        console.error("Error reading contract config:", error);
        throw error;
    }
};


export const getRootCid = async (contractAddress: string) => {

    const provider = new ethers.providers.JsonRpcProvider({
        url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
    });
    
    const contract = new ethers.Contract(
        contractAddress,
        publicationAbi,
        provider
    );

    try {   
        const fragment = contract.interface.getFunction("initUpdate");
        if (!fragment) {
            throw new Error("Failed to get function fragment");
        }     

        // Create transaction data
        const txData = contract.interface.encodeFunctionData("initUpdate", []);
        
        // Get PKP public key from token ID
        const tokenId = "0xab00ba789537484d7a597961a1c0921acf9cfa923f948b37c69612a82f20ab9f"; // Replace with your actual PKP token ID
        const pkpPublicKey = "04554f0e5e94819716659425fbe1d3de01449afe5dc2185ae2ac7ac31e3d75e22b4dce97e702a0d2210db2ca1c43f05836de11a71f9625a6c8d48c14c154b90ff0";
        
        const ethAddress = ethers.utils.computeAddress(`0x${pkpPublicKey}`);
        const nonce = await provider.getTransactionCount(ethAddress);

        // Log PKP permissions and methods for specific PKP
        // const permittedActions = await Lit.Actions.getPermittedActions({ tokenId });
        // console.log('Permitted Actions for PKP:', permittedActions);

        // const permittedAddresses = await Lit.Actions.getPermittedAddresses({ tokenId });
        // console.log('Permitted Addresses for PKP:', permittedAddresses);

        // const permittedAuthMethods = await Lit.Actions.getPermittedAuthMethods({ tokenId });
        // console.log('Permitted Auth Methods for PKP:', permittedAuthMethods);

        // Prepare transaction
        const tx = {
            to: contractAddress,
            data: txData,
            nonce: nonce,
            gasLimit: ethers.utils.hexlify(100000), // adjust as needed
            gasPrice: await provider.getGasPrice(),
            chainId: 84532 // base-sepolia chainId
        };

        // Get the transaction hash to sign
        const unsignedTx = ethers.utils.serializeTransaction(tx);
        const msgHash = ethers.utils.keccak256(unsignedTx);
        
        // Sign transaction with Lit PKP
        const signedTx = await Lit.Actions.signEcdsa({
            toSign: ethers.utils.arrayify(msgHash),
            publicKey: pkpPublicKey,
            sigName: "initUpdate",
            // accessControlConditions: [
            //     {
            //         conditionType: "evmBasic",
            //         contractAddress: "",
            //         standardContractType: "",
            //         chain: "base-sepolia",
            //         method: "",
            //         parameters: [":userAddress"],
            //         returnValueTest: {
            //             comparator: "=",
            //             value: ":userAddress"  // This will always return true
            //         }
            //     }
            // ],
            // permanent: true,
            // expiration: "2100-01-01T00:00:00.000Z"
        });

        return signedTx;

        // Send signed transaction
        // const serializedTx = ethers.utils.serializeTransaction(tx, signedTx.signature);
        // const txResponse = await provider.sendTransaction(serializedTx);
        // await txResponse.wait();

        // // Get the updated root CID
        // return await contract.getHtmlRoot();
        
    } catch (error) {
        console.error("Error updating root CID:", error);
        throw error;
    }
}

export const updateRootCid = async (cid: string, contractAddress: string) => {


    const provider = new ethers.providers.JsonRpcProvider({
        url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
    });

  
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    const contract = new ethers.Contract(
        contractAddress,
        publicationAbi,
        wallet
    );

    

    try {
        const tx = await contract.updateHtmlRoot(cid);
        await tx.wait();
        console.log("Successfully updated root CID");
        return true;
        
    } catch (error) {
        console.error("Error updating root CID:", error);
        throw error;
    }
}