import { publicationAbi } from "./abi";
// import { pkpPublicKey } from "./constants";
import { evmRead, evmWrite } from "./evm";
import { getDag, uploadFile, updateDagAtPath, putDag } from "./ipfs.factory";

export const updateRoot = async (pkpPublicKey: string, body: any, mapping: any, publication: string, htmlResult: string) => {

    try {

        let path = body.language == 'nl' ? mapping.path: `/en${mapping.path}`;
        path = path.replace('{slug}', body.slug);

      //  const initUpdateResult = await evmWrite(pkpPublicKey, publication, publicationAbi, 'initUpdate', [], 0, true);
        const currentRootCid = await evmRead(publication, publicationAbi, 'getHtmlRoot', []);

        const currentDag = await getDag(currentRootCid);
        // console.log(`current dag: ${JSON.stringify(currentDag)}`);
            
        // Upload new file to IPFS
        const newFileCid = await uploadFile(htmlResult);
        // console.log(`new file cid: ${newFileCid}`);

        // Update the DAG with the new CID at the specified path
        const updatedDag = updateDagAtPath(currentDag, path, newFileCid);
        // console.log(`updated dag: ${JSON.stringify(updatedDag)}`);

        // Put the updated DAG to IPFS      
        const newRootCid = await putDag(updatedDag);
        console.log(`new root cid: ${newRootCid}`);

        const updateRootCidResult = await evmWrite(pkpPublicKey, publication, publicationAbi, 'updateHtmlRoot', [newRootCid], 1, true);

        console.log(`update root cid result: ${JSON.stringify(updateRootCidResult)}`);

        return newRootCid;
    
    } catch (error) {
        console.error("Error updating root CID:", error);
        throw error;
    }
}