const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

// Pinata API credentials
const PINATA_API_KEY = 'f2fe40a4bd376f11f598';
const PINATA_SECRET_API_KEY = 'ea84fb79906d44aab1ddb4a8a1f768c2c50885710bca057b66a76673871540c2';

// Function to upload a file to Pinata
async function uploadToPinata(filePath) {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    try {
        const response = await axios.post(url, formData, {
            maxContentLength: 'Infinity',
            headers: {
                ...formData.getHeaders(),
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_API_KEY
            }
        });
        console.log('File uploaded successfully:', response.data);
    } catch (error) {
        console.error('Error uploading file:', error);
    }
}

// Execute the upload function if this script is run directly
if (require.main === module) {
    const filePath = process.argv[2]; // Get the file path from command line arguments
    if (!filePath) {
        console.error('Please provide a file path to upload.');
        process.exit(1);
    }
    uploadToPinata(filePath);
}