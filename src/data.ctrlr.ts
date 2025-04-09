import { AuthSig } from "@lit-protocol/auth-helpers";
import { model, context } from "./constants";
import { decrypt } from "./decrypt";
import { runQuery } from "./orbis.factory";
import { validateInputs } from "./checks";

export const getTemplateData = async (config : any, mapping : any, body : any, safeAddress: string) => {

    try {

        // console.log(config);

        if (config.encrypted) {
            
            const { ciphertext, dataToEncryptHash } = JSON.parse(body.content);
            const decryptedContent = await decrypt(body.publication, safeAddress, ciphertext, dataToEncryptHash);
            console.log('Decryption successful');
            body.content = decryptedContent;
        }

        const collections: any = {};

        for (const collection of mapping.collections) {
            if (collection.source === 'orbisdb') {
                const query = collection.query
                    .replace("{{table}}", model)
                    .replace("{{key}}", collection.key)
                    .replace("{{value}}", collection.value)
                    .replace("{{lang}}", body.language);
                const results = await runQuery(query, context);

                for (const result of results) {
                    result.custom = JSON.parse(result.custom || '{}');
                }
                if (results) collections[collection.slug] = results;
            }
        }

        const templateData = {
            ...body,
            ...collections,
            custom: JSON.parse(body.custom || '{}'),
            content: (body.content || '')
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\'),
            creation_date: new Date(parseInt(body.creation_date) * 1000).toISOString(),
            modified_date: new Date(parseInt(body.modified_date) * 1000).toISOString()
        };

        return JSON.stringify(templateData);
        

    } catch (error) {
        
        console.error('Error in templateData:', error);
        return JSON.stringify({});
    }
}