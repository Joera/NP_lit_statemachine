export const runQuery = async (query: string, context: string) => {
    try {
        // console.log(`Running query: ${query} with context: ${context}`);
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