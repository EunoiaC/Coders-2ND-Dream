import { put, del } from '@vercel/blob';
import fs from 'fs';
import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export default async function upload_pfp(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests allowed' });
    }

    // check auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        // Assuming the file is sent as a base64 string in the request body
        const { fileExtension, fileData } = req.body;

        if (!fileExtension || !fileData) {
            return res.status(400).json({ message: 'fileExtension and fileData are required' });
        }

        // Calculate the file size in bytes
        const fileSizeInBytes = (fileData.length * 3) / 4; // Base64 size to bytes
        const maxSizeInBytes = 300 * 1024; // 300KB in bytes

        // Check if the file exceeds the 300KB limit
        if (fileSizeInBytes > maxSizeInBytes) {
            return res.status(400).json({ message: 'File size exceeds 300KB limit' });
        }

        // Convert base64 to a buffer
        const buffer = Buffer.from(fileData, 'base64');

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        let uid = decodedToken.uid;

        let fileName = "pfp/" + uid + "." + fileExtension;

        await del(fileName);

        // Upload the file to Vercel Blob
        const { url } = await put(fileName, buffer, {
            access: 'public', // Make the file publicly accessible
            token: process.env.BLOB_READ_WRITE_TOKEN, // Use the environment variable
            addRandomSuffix: false, // we want the file to be overwriteable
            cacheControlMaxAge: 0
        });

        // Return the public URL of the uploaded file
        return res.status(200).json({ url });
    } catch (error) {
        console.error('Error uploading file:', error);
        return res.status(500).json({ message: 'Failed to upload file' });
    }
}