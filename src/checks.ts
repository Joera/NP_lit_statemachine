export const validateInputs = (config : any, mapping : any, body : any, safeAddress: string) => {

    if (!config) {
        throw new Error('Config is required');
    }

    if (!mapping) {
        throw new Error('Mapping is required');
    }

    if (!body) {
        throw new Error('Body is required');
    }

    if (!safeAddress) {
        throw new Error('SafeAddress is required');
    }

    if (config.encrypted) {
    
        let parsedContent;
        try {
            parsedContent = JSON.parse(body.content);
            console.log('Successfully parsed body.content');
        } catch (e) {
            console.error('Error parsing body.content:', e);
            throw new Error('Invalid content format');
        }

        if (!parsedContent || !parsedContent.ciphertext || !parsedContent.dataToEncryptHash) {
            console.error('Parsed content:', parsedContent);
            throw new Error('Missing required encryption data');
        }
    }
}
