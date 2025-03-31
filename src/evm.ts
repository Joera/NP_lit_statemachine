import { ALCHEMY_KEY } from "./constants";
declare global {
    const Lit: any;
}


const evmSetup = (contractAddress: string, publicationAbi: any) => {

    const provider = new ethers.providers.JsonRpcProvider({
        url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
    });
    
    const contract = new ethers.Contract(   
        contractAddress,
        publicationAbi,
        provider
    );

    return { provider,contract };
    
}

export const evmWrite = async (
    pkpPublicKey: string, 
    contractAddress: string, 
    publicationAbi: any,
    method: string,
    args: any[],
    index: number,
    confirm: boolean = true

) => {

    const ethAddress = ethers.utils.computeAddress(`0x${pkpPublicKey}`);
    const { provider, contract } = evmSetup(contractAddress, publicationAbi);
    
      // Check balance and nonce
    const balance = await provider.getBalance(ethAddress);
    // console.log('Account balance:', ethAddress, ethers.utils.formatEther(balance), 'ETH');
    
    // Get the latest nonce, including pending transactions
    let nonce = await provider.getTransactionCount(ethAddress, "pending");
    // console.log('Pending nonce:', nonce);
      
    const txData = contract.interface.encodeFunctionData(method, args);

    const gasPrice = await provider.getGasPrice();
    
    // Use fixed 1.1x multiplier for gas price
    const adjustedGasPrice = gasPrice.mul(11).div(10);
    // console.log('Gas price:', ethers.utils.formatUnits(adjustedGasPrice, 'gwei'), 'gwei');

    const tx = {
        to: contractAddress,
        data: txData,
        nonce: nonce,
        gasLimit: ethers.utils.hexlify(100000),
        gasPrice: adjustedGasPrice,
        chainId: 84532,
        value: 0
    };

    // console.log('Transaction details:', {
    //     nonce: tx.nonce,
    //     gasPrice: ethers.utils.formatUnits(tx.gasPrice, 'gwei') + ' gwei',
    //     gasLimit: tx.gasLimit
    // });
    
      // Get the transaction hash to sign
    const unsignedTx = ethers.utils.serializeTransaction(tx);
    const msgHash = ethers.utils.keccak256(unsignedTx);

    console.log("auth:", Lit.Auth.authSigAddress);

    // Test condition that always succeeds
    const accessControlConditions = [
        {
            contractAddress: contractAddress,
            standardContractType: '',
            chain: 'ethereum',
            method: 'canPublish',
            parameters: [':userAddress'],
            returnValueTest: {
                comparator: '==',
                value: true  
            }
        }
    ];

    const signature = await Lit.Actions.signAndCombineEcdsa({
        toSign: ethers.utils.arrayify(msgHash),
        publicKey: pkpPublicKey,
        sigName: `${method}-${index}`,
        accessControlConditions,
        authMethod: {
            authMethodType: 1,
            accessToken: Lit.Auth.authSig 
        }
    });
    
    const s = JSON.parse(signature);

    // Ensure r and s are exactly 32 bytes (64 characters)
    const rFixed = '0x' + s.r.slice(-64); // Take last 64 characters
    const sFixed = '0x' + s.s;
    const vFixed = Number(s.v);

    const serializedSignature = ethers.utils.joinSignature({
        r: rFixed,
        s: sFixed,
        v: vFixed
    });
    
    const serializedTx = ethers.utils.serializeTransaction(tx, serializedSignature);
    // console.log('Serialized transaction:', serializedTx);


    let result = await Lit.Actions.runOnce({
        waitForResponse: true,
        name: `${method}-${index}`,
        jsParams: {serializedTx, index}
    }, async () => {
        try {
            const txResponse = await provider.sendTransaction(serializedTx);
            // console.log(JSON.stringify(txResponse));
            console.log('Transaction sent! Hash:', txResponse.hash);
            if (confirm) {
                const receipt = await provider.waitForTransaction(txResponse.hash);
                console.log('Transaction confirmed in block:', receipt.blockNumber);
            }
            return JSON.stringify({ hash: txResponse.hash });
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('Error sending transaction:', errMsg);
            return JSON.stringify({ error: errMsg });
        }
    });

    return result ? JSON.parse(result) : { hash: null };

};

export const evmRead = async (
    contractAddress: string, 
    publicationAbi: any, 
    method: string, 
    args: any[]
) => {

    const { provider, contract } = evmSetup(contractAddress, publicationAbi);
    return await contract[method](...args);

}


