import { ContractInfo, EventInfo, EVMContractEventListener, StateMachine } from "@lit-protocol/event-listener";
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { LIT_CHAINS } from '@lit-protocol/constants';
import { ethers } from 'ethers';
import FormData from 'form-data';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import Handlebars from 'handlebars';
import { helpers } from "./handlebars-helpers";
import path from 'path';
import { decode } from 'html-entities';
import { Readable } from 'stream';

// Load environment variables
dotenv.config();

async function neutralPress() {

    const runQuery = async (query: string, context: string) => {
        try {
            console.log(`Running query: ${query} with context: ${context}`);
            const response = await fetch(`https://orbis-read.transport-union.dev/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ query, context })
            });
            if (!response.ok) {
                throw new Error(`Failed to run query: ${response.statusText}`);
            }
            const data = await response.json();
            if (!data) {
                throw new Error("Empty response from query");
            }
            return data;
        } catch (error) {
            console.error("Error in runQuery:", error);
            throw error;
        }
    };

    const publicationAbi = [
        {
            "inputs": [
              {
                "internalType": "string",
                "name": "_html_root",
                "type": "string"
              }
            ],
            "name": "updateHtmlRoot",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "initUpdate",
            "outputs": [
              {
                "internalType": "string",
                "name": "",
                "type": "string"
              }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getHtmlRoot",
            "outputs": [
              {
                "internalType": "string",
                "name": "",
                "type": "string"
              }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getConfig",
            "outputs": [
                {
                "internalType": "string",
                "name": "",
                "type": "string"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    const readConfig = async (contractAddress: string) => {
        try {
            const provider = new ethers.providers.JsonRpcProvider({
                url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
            });
            const code = await provider.getCode(contractAddress);
            if (code === "0x") {
                throw new Error(`No contract found at address ${contractAddress}`);
            }
            console.log("Contract code exists at address");
            const contract = new ethers.Contract(
                contractAddress,
                publicationAbi,
                provider
            );
            console.log("Attempting to call config()...");
            const configCid = await contract.getConfig();
            console.log("Raw response:", configCid);
            if (!configCid || configCid === "0x") {
                throw new Error("Config returned empty value");
            }
            console.log("Retrieved config:", configCid);
            return configCid;
        } catch (error) {
            console.error("Error reading contract config:", error);
            throw error;
        }
    };

    const getPublicationConfig = async (publication_address : string, post_type: string) => {
        try {
            const ipfsUrl = process.env.IPFS_URL;
            const configCid = await readConfig(publication_address);
            if (!configCid) {
                throw new Error(`Failed to read config for publication: ${publication_address}`);
            }
            const response = await fetch(`${ipfsUrl}/api/v0/cat?arg=${configCid}`, {
                method: "POST"
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch config from IPFS: ${response.statusText}`);
            }
            const config = await response.json();
            if (!config || !config.mapping) {
                throw new Error("Invalid config format: missing mapping");
            }
            let mapping: any = config.mapping.find((m: any) => m.reference === post_type);
            if (!mapping) {
                mapping = config.mapping.find((m: any) => {
                    return m.collections?.some((collection: any) => collection.value === post_type);
                });
            }
            if (!mapping) {
                throw new Error(`No mapping found for post_type: ${post_type}`);
            }
            return { config, mapping };
        } catch (error) {
            console.error("Error in getPublicationConfig:", error);
            throw error;
        }
    };

    const registerHelpers = async () => {
        
        if(helpers) {
            helpers.forEach((helper: any) => {
                try {
                    Handlebars.registerHelper(helper.name, helper.helper); // register helper
                }
                catch (error) {
                    console.error("failed to register helper: " + helper.name);
                }
            });
        }
    }
    
    const registerPartials = async (partials: any[]): Promise<void> => {
        try {   
            for (let item of partials) {
                const response = await fetch(`https://ipfs.transport-union.dev/api/v0/cat?arg=${item.cid}`, {
                    method: 'POST',
                }); 
                
                if (!response.ok) {
                    console.warn(`Failed to fetch partial ${item.path}: ${response.status} ${response.statusText}`);
                    continue;
                }
    
                let source = await response.text();
                
                // Clean up the partial source
                source = decode(source);
                source = source.replace(/\\n/g, '\n');
                source = source.replace(/\\([^\\])/g, '$1');
                source = source.replace(/\n{2,}/g, '\n');
                source = source.replace(/"\n\s*"/g, '');
                source = source.replace(/^"/, '').replace(/"$/, '');
                source = source.replace(/\\"/g, '"');
                
                const partialName = path.basename(item.path).split(".")[0];
                Handlebars.registerPartial(partialName, source);
            }
        } catch (error) {
            console.error("Failed to register partials:", error);
            throw error; // Propagate error to main render function
        }
    }

    const uploadFile = async (output: string) => {
        const ipfsApiUrl = `${process.env.IPFS_URL}/api/v0/add`;
        const formData = new FormData();
        formData.append('file', output);
    
        const response = await fetch(ipfsApiUrl, {
            method: 'POST',
            body: formData
        });
    
        if (!response.ok) {
            throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
        }
    
        const result = await response.json();
        return result.Hash;
    }
    
    const getDag = async (cid: string) => {
        const ipfsApiUrl = `${process.env.IPFS_URL}/api/v0/dag/get?arg=${cid}`;
        const response = await fetch(ipfsApiUrl, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`IPFS request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    }
    
    interface DagNode {
        [key: string]: string | DagNode | Array<{
            Hash: { "/": string };
            Name: string;
            Tsize: number;
        }> | undefined;
        Links?: Array<{
            Hash: { "/": string };
            Name: string;
            Tsize: number;
        }>;
    }
    
    const updateDagAtPath = (dag: DagNode, path: string, newCid: string): DagNode => {
    
        console.log(`updating dag at path ${path} to ${newCid}`);
        // Split path into segments (e.g., "blog/posts/1" -> ["blog", "posts", "1"])
        const segments = path.split('/').filter(s => s.length > 0);
        
        // Create a copy of the DAG to avoid mutating the original
        let result = { ...dag };
    
        // Ensure Links array exists
        if (!result.Links) {
            result.Links = [];
        }
    
        if (segments.length === 0) {
            // If no path specified, update/add index.html while preserving other entries
            result["index.html"] = { "/": newCid };
            
            // Update or add to Links array
            const existingLinkIndex = result.Links.findIndex(link => link.Name === "index.html");
            if (existingLinkIndex !== -1) {
                result.Links[existingLinkIndex] = {
                    Hash: { "/": newCid },
                    Name: "index.html",
                    Tsize: 0  // You might want to get the actual size if available
                };
            } else {
                result.Links.push({
                    Hash: { "/": newCid },
                    Name: "index.html",
                    Tsize: 0  // You might want to get the actual size if available
                });
            }
            return result;
        }
    
        let current = result;
        for (let i = 0; i < segments.length - 1; i++) {
            const segment = segments[i];
            // Create path if it doesn't exist
            if (!(segment in current)) {
                current[segment] = {};
            }
            // Move deeper into the tree
            current = current[segment] as DagNode;
        }
        
        // Set the final segment to the new CID
        const lastSegment = segments[segments.length - 1];
        current[lastSegment] = { "/": newCid };
    
        // Update or add to Links array
        const fullPath = segments.join('/');
        const existingLinkIndex = result.Links.findIndex(link => link.Name === fullPath);
        if (existingLinkIndex !== -1) {
            result.Links[existingLinkIndex] = {
                Hash: { "/": newCid },
                Name: fullPath,
                Tsize: 0  // You might want to get the actual size if available
            };
        } else {
            result.Links.push({
                Hash: { "/": newCid },
                Name: fullPath,
                Tsize: 0  // You might want to get the actual size if available
            });
        }
    
        // result = removeDagItem(result, "wat-is-er-nou-zo-leuk-aan-nfts");
      
    
        console.log('updated dag:', result);
        
        return result;
    }
    
    const removeDagItem = (dag: DagNode, name: string): DagNode => {
    
        // we want to remove by cid, not name as name can change. 
        // does this mean we need to keep track of the cid in obsidian? 
        // the consistent id = the stream_id .. should we include that in dag 
    
        // Create a new object without the specified key
        const { [name]: removed, ...rest } = dag;
        
        // Preserve the Links array if it exists
        if (dag.Links) {
            return { ...rest, Links: dag.Links };
        }
        
        return rest;
    };
    
    const putDag = async (dag: DagNode): Promise<string> => {
        
        const ipfsApiUrl = `${process.env.IPFS_URL}/api/v0/dag/put?store-codec=dag-cbor&input-codec=dag-json&pin=true`;
        
        // Create form data with the DAG JSON
        const formData = new FormData();
        const buffer = Buffer.from(JSON.stringify(dag));
        const stream = Readable.from(buffer);
        formData.append('file', stream, {
            filename: 'dag.json',
            contentType: 'application/json'
        });
    
        const response = await fetch(ipfsApiUrl, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`IPFS DAG put failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const result = await response.json();
        if (result.Cid) {
            return result.Cid["/"];
        } else {
            throw new Error(`Invalid response from IPFS: ${JSON.stringify(result)}`);
        }
    }

    

    const getRootCid = async (contractAddress: string) => {

        const provider = new ethers.providers.JsonRpcProvider({
            url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
        });
    
        if (!process.env.PRIVATE_KEY) {
            throw new Error("Private key not found in environment variables");
        }
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        const contract = new ethers.Contract(
            contractAddress,
            publicationAbi,
            wallet
        );
    
        try {   
            const fragment = contract.interface.getFunction("initUpdate");
            if (!fragment) {
                throw new Error("Failed to get function fragment");
            }     
    
            // First initiate the update
            const tx = await contract.initUpdate();
            await tx.wait(); // Wait for the update to be confirmed
            
            // Now get the updated root CID
            return await contract.getHtmlRoot();
            
        } catch (error) {
            console.error("Error updating root CID:", error);
            throw error;
        }
    }
    
    const updateRootCid = async (cid: string, contractAddress: string) => {
    
        const provider = new ethers.providers.JsonRpcProvider({
            url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
        });
    
        if (!process.env.PRIVATE_KEY) {
            throw new Error("Private key not found in environment variables");
        }
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        const contract = new ethers.Contract(
            contractAddress,
            publicationAbi,
            wallet
        );
    
        try {
            const tx = await contract.updateHtmlRoot(cid);
            await tx.wait();
            console.log("Successfully updated root CID");
            return true;
            
        } catch (error) {
            console.error("Error updating root CID:", error);
            throw error;
        }
    }
    

    const litNodeClient = new LitNodeClient({
      litNetwork: 'datil-dev',
    });
    const litContracts = new LitContracts({
      network: 'datil-dev',
    });
    const stateMachine = new StateMachine({
      privateKey: 'NOT_USED',
      litNodeClient,
      litContracts,
    });

    interface NPCollection {
        source: string
        key: string
        value: string
        query: string
        slug: string
    }
    
    interface NPRipple {
        query: string
        value: string
        post_type: string
    }
    
    interface NPTemplate {
        reference: string
        file: string
        path: string
        collections: NPCollection[]
        ripples: NPRipple[]
    }

    // Define interfaces for the state machine context
    interface ConfigData {
      body: {
        language: string;
        post_type: string;
        [key: string]: any;
      };
      config: any;
      mapping: NPTemplate;
      contract?: string;
      stream_id: string;
    }

    const model = "kjzl6hvfrbw6c9azzndholpflixynj59zr85g87quflikiem9mfeevnl2v0oz52";
    const context = "kjzl6kcym7w8ya9eooishoahx3dehdyzticwolc95udtobxcnpk3m3zrpf5o4fa";

    const contractABI = [
        "event NPublish(address indexed author, address indexed publication, string cid)"
    ];

    const contractInfo : ContractInfo = {
      address: process.env.NPRINTER_ADDRESS || "",
      abi: contractABI,
    }
    // Log chain info
    const baseSepoliaChain = {
      name: 'Base Sepolia',
      rpcUrls: [`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`],
      chainId: 84532,
    };
    console.log('Using chain:', baseSepoliaChain);

    const eventInfo: EventInfo = {
        name: 'NPublish'
    };

    const contractListener = new EVMContractEventListener(
        baseSepoliaChain.rpcUrls[0],
        contractInfo,
        eventInfo
    );

    // Add states to the state machine
    stateMachine.addState({
        key: 'listenEvents',
        onEnter: async () => console.log('Started listening for NPublish events'),
        onExit: async () => console.log('Processing NPublish event!'),
    });

    stateMachine.addState({
        key: 'processConfig',
        onEnter: async () => {
            console.log('Processing config and fetching data...');

            const stream_id : string = stateMachine.getFromContext('stream_id');
            const publication : string = stateMachine.getFromContext('publication');
            const author : string = stateMachine.getFromContext('author');

            if (!stream_id || !publication) {
                console.log('Cannot proceed: stream_id and publication must be known');
                return;
            }

            try {
                const results = await runQuery(`SELECT * FROM ${model} WHERE stream_id = '${stream_id}'`, context);
                if (!results || !results.length) {
                    throw new Error(`No data found for stream_id: ${stream_id}`);
                }
                const body = results[0];
                if (!body.post_type) {
                    throw new Error("Missing post_type in query result");
                }
                const { config, mapping } = await getPublicationConfig(publication, body.post_type);
                
                const configData = { 
                    body, 
                    config, 
                    mapping, 
                    contract: publication,
                    stream_id 
                };
                
                stateMachine.setToContext('configData', configData);
            } catch (error) {
                console.error("Error in getConfig:", error);
                throw error;
            }
        },
        onExit: async () => console.log('Done processing config!'),
    });

    stateMachine.addState({
        key: 'processTemplateData',
        onEnter: async () => {

            console.log('Gathering template data...');

            try {
                // Get data from previous state
                const { body, config, mapping, contract, stream_id } = stateMachine.getFromContext('configData') as ConfigData;
                let collections: any = {};
        
                for (const collection of mapping.collections) {
                    try {
                        if (collection.source === 'orbisdb') {
                            let query = collection
                                .query.replace("{{table}}", model)
                                .replace("{{key}}", collection.key)
                                .replace("{{value}}", collection.value)
                                .replace("{{lang}}", body.language);
        
                            const results = await runQuery(query, context);
                        
                            if (!results) {
                                console.warn(`No results found for collection ${collection.key}`);
                                continue;
                            }
        
                            for (let result of results) {
                                try {
                                    if (result.custom) {
                                        const custom = JSON.parse(result.custom);
                                        for (const [key, value] of Object.entries(custom)) {
                                            result[key] = value;
                                        }
                                    }
                                } catch (parseError) {
                                    console.error(`Error parsing custom data for result in collection ${collection.key}:`, parseError);
                                    // Continue with the next result
                                    continue;
                                }
                            }
        
                            collections[collection.key] = results;
                        }
                    } catch (collectionError) {
                        console.error(`Error processing collection ${collection.key}:`, collectionError);
                        // Continue with the next collection
                        continue;
                    }
                }
        
                const templateData = {
                    ...body,
                    ...collections
                };

                // console.log('Template data:', templateData);

                stateMachine.setToContext('templateData', templateData);

            } catch (error) {
                console.error('Error in getTemplateData:', error);
                throw error;
            }
        },
        onExit: async () => {
          console.log('Exiting processTemplateData state...');
        },
    });

    stateMachine.addState({
        key: 'renderer',
        onEnter: async () => {
            
                console.log('Running renderer...');

            try {

                const { config, mapping } = stateMachine.getFromContext('configData') as ConfigData;

                const response = await fetch(`https://ipfs.transport-union.dev/api/v0/dag/get?arg=${config.template_cid}`, {
                    method: 'POST',
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch template listing: ${response.status} ${response.statusText}`);
                }
                
                const templateArray = await response.json();
                // console.log(templateArray);
        
                await registerHelpers();
                await registerPartials(templateArray.filter((t: any) => t.path.includes("partials/"))); 

                const templateFile = templateArray.find(
                    (t: any) => t.path.includes(mapping.file)
                );
        
                if (!templateFile) {
                    throw new Error(`Template file ${mapping.file} not found`);
                }
        
                const contentResponse = await fetch(`https://ipfs.transport-union.dev/api/v0/cat?arg=${templateFile.cid}`, {
                    method: 'POST',
                });
        
                if (!contentResponse.ok) {
                    throw new Error(`Failed to load template: ${contentResponse.status} ${contentResponse.statusText}`);
                }
        
                let source = await contentResponse.text();
        
                // Clean up the template source
                source = decode(source); // Decode HTML entities
                source = source.replace(/\\n/g, '\n'); // Convert \n to actual newlines
                source = source.replace(/\\([^\\])/g, '$1'); // Remove single backslashes except double backslashes
                source = source.replace(/\n{2,}/g, '\n'); // Replace multiple newlines with single newline
                source = source.replace(/"\n\s*"/g, ''); // Remove quoted newlines with spaces
                source = source.replace(/^"/, '').replace(/"$/, ''); // Remove leading/trailing quotes
                
                // Remove unnecessary escaping in HTML attributes
                source = source.replace(/\\"/g, '"'); // Convert \" to "
                
                const templater = Handlebars.compile(source, {
                    noEscape: true // Don't escape HTML entities in variables
                });
        
                let html = templater(stateMachine.getFromContext('templateData'));
                
                // Clean up the rendered output
                html = html
                    .replace(/\n{2,}/g, '\n') // Replace multiple newlines with single newline
                    .replace(/>\s+</g, '>\n<') // Add proper newlines between tags
                    .trim(); // Remove leading/trailing whitespace


                // console.log(html);

                stateMachine.setToContext('html', html);
        
            } catch (error) {
                console.error('Error rendering template:', error);
                throw error;
            }

        },
        onExit: async () => {
            console.log('Exiting renderer state...');
          },
    });

    stateMachine.addState({
        key: 'store',
        onEnter: async () => {

            try {

                const { body, mapping, contract } = stateMachine.getFromContext('configData') as ConfigData;

                if (!body || !mapping || !contract) {
                    console.log('Cannot proceed: body, mapping, and contract must be known');
                    return;
                }

                let path = body.language == 'nl' ? mapping.path: `/en${mapping.path}`;
                path = path.replace('{slug}', body.slug);
        
                // Get current root CID and DAG from IPFS
                const currentRootCid = await getRootCid(contract);
                console.log(`current root cid: ${currentRootCid}`);
                const currentDag = await getDag(currentRootCid);
                console.log(`current dag: ${JSON.stringify(currentDag)}`);
                    
                // Upload new file to IPFS
                const newFileCid = await uploadFile(stateMachine.getFromContext('html'));
                console.log(`new file cid: ${newFileCid}`);
        
                // Update the DAG with the new CID at the specified path
                const updatedDag = updateDagAtPath(currentDag, path, newFileCid);
                console.log(`updated dag: ${JSON.stringify(updatedDag)}`);
        
                // Put the updated DAG to IPFS
                const newRootCid = await putDag(updatedDag);
                console.log(`new root cid: ${newRootCid}`);
        
                // Update the contract with the new root CID
                await updateRootCid(newRootCid, contract);
        
            } catch (error) {
                console.error(error);
            }

        },
        onExit: async () => {
        }
    });

    // Add transition that listens for events
    stateMachine.addTransition({
      fromState: 'listenEvents',
      toState: 'processConfig',
      listeners: [contractListener],
      check: async (values): Promise<boolean> => {
        const event = values[0] as ethers.Event;
        if (!event || !event.args) return false;
        
        return true;
      },
      onMatch: async (values) => {
        const event = values[0] as ethers.Event;
        if (!event || !event.args) return;

        console.log(event.args);

        const author = event.args[0];
        const publication = event.args[1];
        const stream_id = event.args[2];
        console.log('Author:', author);
        console.log('Publication:', publication);
        console.log('Stream ID:', stream_id);
      
        stateMachine.setToContext('stream_id', stream_id);
        stateMachine.setToContext('author', author);
        stateMachine.setToContext('publication', publication);
      }
    });

    // Add transition from processConfig to handleConfig
    stateMachine.addTransition({
      fromState: 'processConfig',
      toState: 'processTemplateData',
      listeners: [],
      check: async (values) => {
        const configData = values[0];
        return !!configData; // Proceed if we have config data
      }
    });

    // Add transition from processConfig to handleConfig
    stateMachine.addTransition({
        fromState: 'processTemplateData',
        toState: 'renderer',
        listeners: [],
        check: async (values) => {
          const configData = values[0];
          return !!configData; // Proceed if we have config data
        }
    });

    stateMachine.addTransition({
        fromState: 'renderer',
        toState: 'store',
        listeners: [],
        check: async (values) => {
          const configData = values[0];
          return !!configData; // Proceed if we have config data
        }
    });

    stateMachine.addTransition({
        fromState: 'store',
        toState: 'listenEvents',
        listeners: [],
        check: async (values) => {
          const configData = values[0];
          return !!configData; // Proceed if we have config data
        }
    });


    // Start the state machine
    await stateMachine.startMachine('listenEvents');
}

neutralPress().catch(console.error);