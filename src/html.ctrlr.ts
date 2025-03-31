import { cleanTemplateString, processPartials, processHelpers } from "./handlebars.factory";

export const renderHTML = async (config: any, mapping: any, templateData: any) => {

    try {
        const response = await fetch(`https://ipfs.transport-union.dev/api/v0/dag/get?arg=${config.template_cid}`, {
            method: 'POST'
        });
        if (!response.ok) {
            console.log('Template fetch failed');
            return;
        }
        
        const templateArray = await response.json();
        const templateFile = templateArray.find(t => t.path.includes(mapping.file));
        if (!templateFile) {
            console.log('Template file not found');
            return;
        }

        // console.log("template",templateFile.cid);

        const templateResponse = await fetch(`https://ipfs.transport-union.dev/api/v0/cat?arg=${templateFile.cid}`, {
            method: 'POST'
        });
        if (!templateResponse.ok) {
            console.log('Template content fetch failed');
            return;
        }

        let template = cleanTemplateString(await templateResponse.text());

        // console.log("template",templateResponse);
        const partialFiles = templateArray.filter(t => t.path.includes("partials/"));
        let result = await processPartials(template, partialFiles, templateData);
        result = processHelpers(result, templateData);

        Object.entries(templateData).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');            
            result = result.replace(regex, value?.toString() || '');
        });

        // console.log("result",result);

        return result.replace(/\n{2,}/g, '\n').replace(/>\s+</g, '>\n<').trim();
        
    } catch (error) {
        console.error('Error in renderer:', error);
        
    }

}