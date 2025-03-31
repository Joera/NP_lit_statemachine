export const contractABI = [
    "event NPublish(address indexed author, address indexed publication, string cid)"
];

export const publicationAbi = [
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
