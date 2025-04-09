import { AuthSig } from "@lit-protocol/auth-helpers";

export const decrypt = async (publicationContract: string, safeAddress: string, ciphertext: string, dataToEncryptHash: string) => {

    const evmContractConditions = [
        {
            contractAddress: publicationContract,
            functionName: "canPublish",
            functionParams: [safeAddress],
            functionAbi: {
                inputs: [
                    {
                        internalType: "address",
                        name: "_author",
                        type: "address"
                    }
                ],
                name: "canPublish",
                outputs: [
                    {
                        internalType: "bool",
                        name: "",
                        type: "bool"
                    }
                ],
                stateMutability: "view",
                type: "function"
            },
            chain: "baseSepolia",
            returnValueTest: {
                key: "",
                comparator: "=",
                value: "true"
            }
        },
        { operator: "and" },
        {
            contractAddress: safeAddress,
            functionName: "isOwner",
            functionParams: [":userAddress"],
            functionAbi: {
                inputs: [
                    {
                        internalType: "address",
                        name: "_userAddress",
                        type: "address"
                    }
                ],
                name: "isOwner",
                outputs: [
                    {
                        internalType: "bool",
                        name: "",
                        type: "bool"
                    }
                ],
                stateMutability: "view",
                type: "function"
            },
            chain: "baseSepolia",
            returnValueTest: {
                key: "",
                comparator: "=",
                value: "true"
            }
        }
    ];


   
    try {
        // console.log('Access control conditions:', JSON.stringify(evmContractConditions, null, 2));
        // console.log("ciphertext: ", ciphertext);
        // console.log(authSig.sig);

        const decryptionParams = {
            accessControlConditions: evmContractConditions,
            ciphertext: ciphertext,
            dataToEncryptHash: dataToEncryptHash,
            authSig: null,
            chain: 'baseSepolia'
        };

        const decrypted = await Lit.Actions.decryptAndCombine(decryptionParams);

        if (!decrypted) {
            throw new Error('Failed to decrypt content');
        }

        return decrypted;

    } catch (error) {
        console.error('Error decrypting:', error);              
        throw error;
    }
}
