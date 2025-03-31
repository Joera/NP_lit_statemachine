// import { publication } from "./constants";
import { getConfig } from "./config.ctrl";
import { getTemplateData } from "./templatedata.ctrlr";
import { renderHTML } from "./html.ctrlr";
import { updateRoot } from "./update.ctrlr";


const main = async () => {
    
    let configResult = await Lit.Actions.runOnce({
        waitForResponse: true,
        name: "config",
        jsParams: { stream_id, publication }
    }, async () => {    
        return await getConfig(stream_id, publication);
    });

    configResult = JSON.parse(configResult);
    const body = configResult.body;
    const config = configResult.config;
    const mapping = configResult.mapping;

    let templateDataResult = await Lit.Actions.runOnce({
        waitForResponse: true,
        name: "templateData",
        jsParams: { body, mapping } 
    }, async () => {   
        return await getTemplateData(mapping, body);
    });

    const templateData = JSON.parse(templateDataResult);
   
    let htmlResult = await Lit.Actions.runOnce({
        waitForResponse: true,
        name: "renderer",
        jsParams: { 
            config, 
            mapping, 
            templateData
        }
    }, async () => {    
        return await renderHTML(config, mapping, templateData);
    });

    let newRootCid = await updateRoot(pkpPublicKey, body, mapping, publication, htmlResult);
    
    // Ensure we have a valid response
    if (!newRootCid) {
        throw new Error('Failed to update root: no CID returned');
    }

    Lit.Actions.setResponse({ response: JSON.stringify({ success: true, rootCid: newRootCid }) });
    
};

main();