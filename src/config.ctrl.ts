import { context, model } from "./constants";
import { readConfig } from "./eth.factory";
import { getPublicationConfig } from "./ipfs.factory";
import { runQuery } from "./orbis.factory";

export const getConfig = async (stream_id: string, publication: string) => {
    
    try {
        if (!stream_id) {
            throw new Error('stream_id is required');
        }

        if (!publication) {
            throw new Error('publication is required');
        }
        
        const results = await runQuery(`SELECT * FROM ${model} WHERE stream_id = '${stream_id}'`, context);
        if (!results?.length) {
            console.error('No results found for stream_id:', stream_id);
            throw new Error('No results found');
        }
        
        const body = results[0];
        const configCid = await readConfig(publication);
        const { config, mapping } = await getPublicationConfig(configCid, body.post_type);
      
        return JSON.stringify({ body, config, mapping });

    } catch (error) {
        console.error('Error in config:', error);
        throw error;
    }
}