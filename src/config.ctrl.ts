import { context, model } from "./constants";
import { readConfig } from "./eth.factory";
import { getPublicationConfig } from "./ipfs.factory";
import { runQuery } from "./orbis.factory";

export const getConfig = async (stream_id: string, publication: string) => {
    
    try {
        
        const results = await runQuery(`SELECT * FROM ${model} WHERE stream_id = '${stream_id}'`, context);
        if (!results?.length) {
            console.log('No results found');
            return null;
        }
        
        const body = results[0];
        if (!body.post_type) {
            console.log('No post_type found');
            return null;
        }
  
        const configCid = await readConfig(publication);
        const { config, mapping } = await getPublicationConfig(configCid, body.post_type);

        // console.log('config:', config);
        // console.log('mapping:', mapping);
        // console.log('body:', body);
    
        return JSON.stringify({ body, config, mapping });


    } catch (error) {
        
        console.error('Error in config:', error);
        return null;
    }
}