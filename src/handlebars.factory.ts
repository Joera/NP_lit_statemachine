import Handlebars from 'handlebars/runtime';
import { helpers } from "./handlebars-helpers";
import { decode } from "html-entities";

interface TemplateData {
    [key: string]: any;
}

interface Partial {
    path: string;
    cid: string;
}

// Get value from templateData using dot notation and array access
const getNestedValue = (path: string, data: TemplateData): any => {
    // Handle array access with dot notation: path.to.[0].property
    const parts = path.split('.');
    return parts.reduce((obj, key) => {
        if (!obj) return undefined;
        
        // Handle array index access: [0]
        if (key.startsWith('[') && key.endsWith(']')) {
            const index = parseInt(key.slice(1, -1));
            return Array.isArray(obj) ? obj[index] : undefined;
        }
        
        return obj[key];
    }, data);
};

// Get value from context, handling special variables and this
const getContextValue = (path: string, context: TemplateData): any => {
    const trimmedPath = path.trim();
    
    // Handle special variables
    if (trimmedPath.startsWith('@')) {
        // Special variables should be at the root level of context
        return context[trimmedPath];
    }
    
    // Handle this keyword
    if (trimmedPath === 'this') {
        return context.this;
    }
    
    // Handle eq helper
    if (trimmedPath.includes('eq')) {
        const eqMatch = /eq\s*\((.*?)\s*,\s*(.*?)\)/i.exec(trimmedPath);
        if (eqMatch) {
            const [_, val1, val2] = eqMatch;
            const resolvedVal1 = getContextValue(val1.trim(), context);
            const resolvedVal2 = getContextValue(val2.trim(), context);
            return resolvedVal1 === resolvedVal2;
        }
    }
    
    // Try getting from this first if it exists
    if (context.this && typeof context.this === 'object') {
        const fromThis = getNestedValue(trimmedPath, context.this);
        if (fromThis !== undefined) {
            return fromThis;
        }
    }
    
    // Fall back to context root
    return getNestedValue(trimmedPath, context);
};

// Process variables in template with support for nested paths
const processVariables = (text: string, context: TemplateData): string => {
    let result = text;
    
    // Process triple braces first (unescaped)
    const tripleVariablePattern = /{{{([^}]+)}}}/g;
    result = result.replace(tripleVariablePattern, (match, path) => {
        const value = getContextValue(path.trim(), context);
        return value?.toString() || '';
    });

    // Then process double braces (escaped)
    const variablePattern = /{{([^#\/][^}]*)}}/g;
    result = result.replace(variablePattern, (match, path) => {
        if (path.trim().startsWith('{') || path.trim().startsWith('/')) {
            return match; // Skip if it looks like the start of a block
        }
        const value = getContextValue(path.trim(), context);
        return escape(value?.toString() || '');
    });
    
    return result;
};

// Process block helpers like {{#if}}, {{#each}}, etc.
const processBlockHelpers = (text: string, templateData: TemplateData): string => {
    let result = text;
    
    // Process if blocks first
    const ifPattern = /{{#if\s+([^}]+)}}\s*([\s\S]*?)(?:{{else}}\s*([\s\S]*?))?{{\/if}}/g;
    result = result.replace(ifPattern, (match, condition, content, elseContent = '') => {
        try {
            // Get the value directly from context for special variables
            const value = condition.trim().startsWith('@') ? 
                templateData[condition.trim()] : 
                getContextValue(condition.trim(), templateData);

            console.log('If block evaluation:', {
                condition: condition.trim(),
                value,
                type: typeof value,
                context: templateData
            });

            const truthy = Boolean(value);
            const selectedContent = truthy ? content : elseContent;
            
            // Process nested content with same context
            return processBlockHelpers(selectedContent, templateData);
        } catch (error) {
            console.error(`Error processing if helper ${condition}:`, error);
            return '';
        }
    });
    
    // Process unless blocks (opposite of if)
    const unlessPattern = /{{#unless\s+([^}]+)}}\s*([\s\S]*?)(?:{{else}}\s*([\s\S]*?))?{{\/unless}}/g;
    result = result.replace(unlessPattern, (match, condition, unlessContent, elseContent = '') => {
        // Check if condition is a variable name or path
        const value = getNestedValue(condition.trim(), templateData) ?? condition.trim();
        const truthy = value && value !== 'false' && value !== '0';
        return truthy ? elseContent : unlessContent;  // Opposite of if
    });

    // Process with blocks (change context)
    const withPattern = /{{#with\s+([^}]+)}}\s*([\s\S]*?){{\/with}}/g;
    result = result.replace(withPattern, (match, contextPath, content) => {
        const newContext = getNestedValue(contextPath.trim(), templateData);
        if (!newContext || typeof newContext !== 'object') {
            // Return empty string for invalid context
            return '';
        }

        // Replace variables in content with values from new context
        let newContent = content;
        Object.entries(newContext).forEach(([key, value]) => {
            const pattern = new RegExp(`{{${key}}}`, 'g');
            newContent = newContent.replace(pattern, value?.toString() || '');
        });

        // Also process any nested helpers in the new context
        return processBlockHelpers(newContent, newContext);
    });
    
    // Process each blocks
    const eachPattern = /{{#each\s+([^}]+)}}\s*([\s\S]*?){{\/each}}/g;
    result = result.replace(eachPattern, (match, arrayPath, content) => {
        const array = getNestedValue(arrayPath.trim(), templateData);
        if (!Array.isArray(array)) {
            console.log('Each block array not found or not an array:', arrayPath);
            return '';
        }

        return array.map((item, index) => {
            // Create a context with special variables while preserving parent context
            const itemContext = {
                ...templateData,  // Keep parent context
                this: item,      // Keep item as 'this'
                '@index': index,
                '@first': index === 0,
                '@last': index === array.length - 1,
                '@key': arrayPath.split('.').pop() || '',
                ...item,         // Spread item properties at top level last to override any conflicts
            };
            
            console.log('Each block context:', {
                arrayPath,
                index,
                isFirst: itemContext['@first'], 
                isLast: itemContext['@last'],
                key: itemContext['@key']
            });

            // First process block helpers (including nested if blocks)
            let processed = processBlockHelpers(content, itemContext);
            
            // Then process any remaining variables
            processed = processVariables(processed, itemContext);
            
            return processed;
        }).join('');
    });

    // Process custom block helpers
    const customBlockPattern = /{{#(\w+)\s+([^}]+)}}\s*([\s\S]*?)(?:{{else}}\s*([\s\S]*?))?{{\/\1}}/g;
    result = result.replace(customBlockPattern, (match, helperName, args, content, elseContent = '') => {
        const helper = helpers.find(h => h.name === helperName);
        if (!helper) return match;

        try {
            // Process arguments - only take the first two space-separated arguments
            const [arg1, arg2] = args.split(' ').map(arg => {
                const trimmedArg = arg.trim();
                // If it's a quoted string, remove the quotes
                if (trimmedArg.startsWith('"') && trimmedArg.endsWith('"')) {
                    return trimmedArg.slice(1, -1);
                }
                // Otherwise check if it's a variable from templateData
                const value = getNestedValue(trimmedArg, templateData);
                return value !== undefined ? value : trimmedArg;
            });

            // console.log(`Calling ${helperName} with processed args:`, [arg1, arg2]);

            // Create options object with fn and inverse functions that properly execute the content
            const options = {
                fn: function() { return content; },
                inverse: function() { return elseContent; }
            };

            // Call the helper with only the first two arguments plus options
            const result = helper.helper.apply(null, [arg1, arg2, options]) || '';
            // console.log(`${helperName} returned:`, result);
            return result;
        } catch (error) {
            console.error(`Error processing block helper ${helperName}:`, error);
            return '';
        }
    });

    return result;
};

export const processTemplate = (text: string, context: TemplateData): string => {
    // First process block helpers
    let result = processBlockHelpers(text, context);
    
    // Then process regular helpers
    result = processHelpers(result, context);
    
    // Finally process variables
    return processVariables(result, context);
};

export const processHelpers = (text: string, templateData: TemplateData): string => {
    // First process block helpers
    let result = processBlockHelpers(text, templateData);
    
    // Then process regular helpers
    const helperPattern = /{{{?([^{}]+)}}}?/g;  // Match both {{helper}} and {{{helper}}}
    
    result = result.replace(helperPattern, (match, helperCall) => {
        helperCall = helperCall.trim();
        
        // Skip partial includes, block helpers, and simple variables
        if (helperCall.startsWith('>') || 
            helperCall.startsWith('#') || 
            helperCall.startsWith('/') || 
            !helperCall.includes(' ')) {
            return match;
        }
        
        const [helperName, ...args] = helperCall.split(' ');
        const helper = helpers.find(h => h.name === helperName);
        
        if (helper) {
            try {
                // Process arguments
                const processedArgs = args.map(arg => {
                    // Check if arg is a path expression
                    const value = getNestedValue(arg, templateData);
                    if (value !== undefined) return value;
                    
                    // Otherwise treat as number or string
                    if (!isNaN(arg as any)) return Number(arg);
                    return arg;
                });
                
                const result = helper.helper.apply(null, processedArgs);
                // If it's a triple brace {{{helper}}}, return unescaped
                return match.startsWith('{{{') ? result || '' : escape(result || '');
            } catch (error) {
                // Return empty string on error
                return '';
            }
        }
        
        // Return empty string for unrecognized helpers
        return '';
    });

    // Finally process any remaining variables
    return processVariables(result, templateData);
};

export const cleanTemplateString = (content: string): string => {
    // Decode HTML entities
    let cleaned = decode(content);
    
    // Replace escaped newlines with actual newlines
    cleaned = cleaned.replace(/\\n/g, '\n');
    
    // Remove escaped characters except for escaped backslashes
    cleaned = cleaned.replace(/\\([^\\])/g, '$1');
    
    // Normalize multiple newlines to single newlines
    cleaned = cleaned.replace(/\n{2,}/g, '\n');
    
    // Remove line breaks between concatenated strings
    cleaned = cleaned.replace(/"\n\s*"/g, '');
    
    // Remove leading/trailing quotes
    cleaned = cleaned.replace(/^"|"$/g, '');
    
    // Unescape quotes
    cleaned = cleaned.replace(/\\"/g, '"');
    
    return cleaned;
};

export const processPartials = async (template: string, partials: Partial[], templateData: TemplateData): Promise<string> => {
    // First fetch and clean all partials
    const processedPartials: { [key: string]: string } = {};
    
    for (const partial of partials) {
        try {
            const response = await fetch(`https://ipfs.transport-union.dev/api/v0/cat?arg=${partial.cid}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                // Return empty string on error
                continue;
            }

            let content = await response.text();
            content = cleanTemplateString(content);
            
            // Get filename without path or extension
            const name = partial.path.substring(partial.path.lastIndexOf('/') + 1).split('.')[0];
            processedPartials[name] = content;
        } catch (error) {
            // Return empty string on error
            continue;
        }
    }
    
    // Then recursively replace partials in template
    let html = template;
    let depth = 0;
    let changed = true;
    
    while (changed && depth < 10) {  // Max 10 levels of nesting
        changed = false;
        for (const [name, content] of Object.entries(processedPartials)) {
            const regex = new RegExp(`{{\\s*?>\\s*${name}\\s*}}`, 'g');
            if (regex.test(html)) {
                // Process helpers in partial before inserting
                const processedContent = processTemplate(content, templateData);
                html = html.replace(regex, processedContent);
                changed = true;
            }
        }
        depth++;
    }
    
    return html;
};

// HTML escape function
const escape = (str: string): string => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Evaluate condition for if helper
const evaluateCondition = (condition: string, context: TemplateData): boolean => {
    const value = getContextValue(condition, context);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value !== '' && value !== 'false' && value !== '0';
    if (typeof value === 'number') return value !== 0;
    return value != null;
};
