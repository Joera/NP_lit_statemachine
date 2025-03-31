import { IPFS_URL } from "./constants";

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

export const getPublicationConfig = async (configCid : string, post_type: string) => {

    // return new Promise(async (resolve, reject) => {
    
        try {

            const response = await fetch(`${IPFS_URL}/api/v0/cat?arg=${configCid}`, {
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

            return {
                config,
                mapping
            }

            return config.name;

        } catch (error) {
            console.error("Error in getPublicationConfig:", error);
            throw(error);
        }
    // });
};

export const uploadFile = async (output: string) => {
    const ipfsApiUrl = `${IPFS_URL}/api/v0/add`;
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

export const getDag = async (cid: string) => {
    const ipfsApiUrl = `${IPFS_URL}/api/v0/dag/get?arg=${cid}`;
    const response = await fetch(ipfsApiUrl, {
        method: 'POST'
    });
    
    if (!response.ok) {
        throw new Error(`IPFS request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
}

export const updateDagAtPath = (dag: DagNode, path: string, newCid: string): DagNode => {

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
  

    // console.log('updated dag:', result);
    
    return result;
}

export const removeDagItem = (dag: DagNode, name: string): DagNode => {

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

// Utility function to convert data to Blob
async function toBlob(data: any): Promise<Blob> {
    if (data instanceof Blob) return data;
    if (typeof data === 'string') return new Blob([data]);
    return new Blob([JSON.stringify(data)]);
}

export const putDag = async (dag: DagNode): Promise<string> => {
        
        const ipfsApiUrl = `${IPFS_URL}/api/v0/dag/put?store-codec=dag-cbor&input-codec=dag-json&pin=true`;
        
        // Convert DAG to blob
        const blob = await toBlob(dag);
    
        const formData = new FormData();
        formData.append('file', blob, 'dag.json');
    
        const response = await fetch(ipfsApiUrl, {
            method: 'POST',
            body: formData
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