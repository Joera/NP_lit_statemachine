import { model, context } from "./constants";
import { decrypt } from "./decrypt";
import { runQuery } from "./orbis.factory";

export const getTemplateData = async (mapping : any, body : any) => {

    try {

        const { ciphertext, dataToEncryptHash } = JSON.parse(body.content);

        body.content = await decrypt(body.publication, authSig, ciphertext, dataToEncryptHash);

        console.log(body.content);
    
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
        return null;
    }
}