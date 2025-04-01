import { AuthSig } from "@lit-protocol/auth-helpers";

export const decrypt = async (publicationContract: string, authSig: AuthSig, ciphertext: string, dataToEncryptHash: string) => {

    console.log(publicationContract);
    console.log('Auth sig:', authSig);
    
    // Extract the wallet address from capabilities
    const walletAddress = JSON.parse(authSig.signedMessage).capabilities[0].address;
    console.log('Wallet address:', walletAddress);
    
    const accessControlConditions = [
        {
            contractAddress: publicationContract,
            standardContractType: "",
            chain: "ethereum",
            method: "canPublish",
            parameters: [walletAddress], // Use actual wallet address instead of :userAddress
            returnValueTest: {
                comparator: "=",
                value: "true"
            }
        }
    ];

   
    try {
        console.log('Access control conditions:', JSON.stringify(accessControlConditions, null, 2));

        const resp = await Lit.Actions.decryptAndCombine({
            accessControlConditions,
            ciphertext,
            dataToEncryptHash,
            chain: 'ethereum',
            authMethod: {
                authMethodType: 1,
                accessToken: authSig 
            }
        });

        console.log('Decryption response:', resp);
        return resp;


    } catch (error) {
        console.error('Error decrypting:', error);
        return null;
    }
}
