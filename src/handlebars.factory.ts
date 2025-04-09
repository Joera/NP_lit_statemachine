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
    if (!data) return undefined;

    // Handle array access with dot notation: path.to.[0].property
    const parts = path.split('.');
    const result = parts.reduce((obj, key) => {
        if (!obj) return undefined;
        
        // Handle array index access: [0]
        if (key.startsWith('[') && key.endsWith(']')) {
            const index = parseInt(key.slice(1, -1));
            return Array.isArray(obj) ? obj[index] : undefined;
        }
        
        return obj[key];
    }, data);

    return result;
};

// Get value from context, handling special variables and this
const getContextValue = (path: string, context: TemplateData): any => {
    const trimmedPath = path.trim();
    
    // Handle special variables
    if (trimmedPath === '@root') return context;
    if (trimmedPath === '@first' || trimmedPath === '@last' || trimmedPath === '@index') {
        return context[trimmedPath];
    }
    if (trimmedPath === 'this') return context;
    
    // Handle nested paths
    return getNestedValue(trimmedPath, context);
};

// Process variables in template with support for nested paths
const processVariables = (text: string, context: TemplateData): string => {
    // Skip if no variables to process
    if (!text.includes('{{')) return text;

    const regex = /{{([^{}]+)}}/g;
    return text.replace(regex, (match, path) => {
        // Skip helpers and blocks
        if (path.startsWith('#') || path.startsWith('/') || path.startsWith('>')) return match;
        
        const value = getContextValue(path, context);
        return value !== undefined ? value.toString() : '';
    });
};

// Process block helpers like {{#if}}, {{#each}}, etc.
const processBlockHelpers = (text: string, templateData: TemplateData): string => {
    // Skip if no block helpers
    if (!text.includes('{{#')) return text;

    const blockRegex = /{{#(\w+)\s+([^}]+)}}([\s\S]*?){{\/\1}}/g;
    return text.replace(blockRegex, (match, helper, args, content) => {
        switch (helper) {
            case 'if': {
                const condition = evaluateCondition(args, templateData);
                return condition ? processTemplate(content, templateData) : '';
            }
            case 'each': {
                const items = getContextValue(args.trim(), templateData);
                if (!Array.isArray(items)) return '';
                
                return items.map((item, index) => {
                    const itemContext = {
                        ...item,
                        '@index': index,
                        '@first': index === 0,
                        '@last': index === items.length - 1
                    };
                    return processTemplate(content, itemContext);
                }).join('');
            }
            default:
                return match;
        }
    });
};

export const processTemplate = (text: string, context: TemplateData): string => {
    if (!text) return '';

    // Process in specific order
    let result = text;
    result = processBlockHelpers(result, context);
    result = processHelpers(result, context);
    result = processVariables(result, context);
    return result;
};

const processHelpers = (text: string, templateData: TemplateData): string => {
    // Skip if no helpers
    if (!text.includes('{{')) return text;

    const helperRegex = /{{(\w+)\s+([^}]+)}}/g;
    return text.replace(helperRegex, (match, helper, args) => {
        if (helper === 'eq') {
            const [a, b] = args.split(' ').map(arg => {
                // Remove quotes if present
                const trimmed = arg.trim();
                if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                    return trimmed.slice(1, -1);
                }
                return getContextValue(trimmed, templateData);
            });
            return a === b ? 'true' : '';
        }
        if (helper === 'backgroundify') {
            const value = getContextValue(args.trim(), templateData);
            return value || '';
        }
        return match;
    });
};

export const cleanTemplateString = (content: string): string => {
    if (!content) return '';
    return decode(content)
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .trim();
};

export const processPartials = async (template: string, partials: Partial[], templateData: TemplateData): Promise<string> => {
    // First fetch and clean all partials
    const processedPartials: { [key: string]: string } = {};
    
    for (const partial of partials) {
        try {
            const response = await fetch(`https://ipfs.transport-union.dev/api/v0/cat?arg=${partial.cid}`, {
                method: 'POST'
            });
            
            if (!response.ok) continue;

            let content = await response.text();
            content = cleanTemplateString(content);
            
            // Get filename without path or extension
            const name = partial.path.substring(partial.path.lastIndexOf('/') + 1).split('.')[0];
            processedPartials[name] = content;
        } catch (error) {
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
            const regex = new RegExp(`{{\\s*>\\s*${name}\\s*}}`, 'g');
            if (regex.test(html)) {
                html = html.replace(regex, content);
                changed = true;
            }
        }
        depth++;
    }
    
    // Process the complete template after all partials are inserted
    return processTemplate(html, templateData);
};

// HTML escape function
const escape = (str: string): string => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Evaluate condition for if helper
const evaluateCondition = (condition: string, context: TemplateData): boolean => {
    const value = getContextValue(condition.trim(), context);
    return Boolean(value);
};
