import { helpers } from "./handlebars-helpers";
import { decode } from 'html-entities';
import Handlebars from 'handlebars';
import path from 'path';

// Main Lit Action function
async function neutralPress(params: any) {
    try {
        // Register Handlebars helpers
        if(helpers) {
            helpers.forEach((helper: any) => {
                try {
                    Handlebars.registerHelper(helper.name, helper.helper);
                } catch (error) {
                    console.error("failed to register helper: " + helper.name);
                }
            });
        }

        // Your main logic here
        // Note: You'll need to adapt your state machine logic to work within a Lit Action
        // This might mean simplifying some parts and removing dependencies that won't work in the Lit Node environment

        return {
            // Return your result
            success: true,
            result: "Template processed successfully"
        };
    } catch (error) {
        console.error("Error in neutralPress Lit Action:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Export the function to be used as a Lit Action
export default neutralPress;
