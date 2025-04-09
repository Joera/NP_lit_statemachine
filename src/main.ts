// import { publication } from "./constants";
import { validateInputs } from "./checks";
import { getConfig } from "./config.ctrl";
import { getTemplateData } from "./data.ctrlr";
import { renderHTML } from "./html.ctrlr";
import { updateRoot } from "./update.ctrlr";
import { AuthSig } from "@lit-protocol/types";

declare global {
    // const Lit: any;
    const safeAddress: string;
    const stream_id: string;
    const publication: string;
    const pkpPublicKey: string;
}

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

    validateInputs(config, mapping, body, safeAddress);

    const templateDataResult = await getTemplateData(config, mapping, body, safeAddress);
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

   // console.log('HTML result:', htmlResult);

   let { newRootCid, path } = await updateRoot(pkpPublicKey, body, mapping, publication, htmlResult);
    
    // Ensure we have a valid response
    if (!newRootCid) {
        throw new Error('Failed to update root: no CID returned');
    }

    Lit.Actions.setResponse({ response: JSON.stringify({ success: true, rootCid: newRootCid, path: config.domains[0].url + path }) });
    
};

main();