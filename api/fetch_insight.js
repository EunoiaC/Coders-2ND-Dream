import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

/**
 * Uploads the given file to Gemini.
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */
async function uploadToGemini(path, mimeType) {
    const uploadResult = await fileManager.uploadFile(path, {
        mimeType,
        displayName: path,
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",

    systemInstruction: "The input will be profile pictures from a dating app. Write insights about the user inferred from the profile picture, which can be people or things the user enjoys. It should be a list of insights formatted as \"insight name: additional comments\". Output as much as you can. The top-level insights array has an object with field \"insights\" for each inputted picture. Do not use a subject for your comments, don't refer to a user as \"the user,\" just say \"likes photos\" instead of \"the user likes photos\". The comment should be a sentence or two long. Do not describe the photo, but describe what it may mean about the user.",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: {
        type: "object",
        properties: {
            insights: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        insights: {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        }
                    }
                }
            }
        }
    },
};

async function fileToGenerativePart(url) {
    const response = await fetch(url);
    // Get MIME type from response headers
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const imageResp = await response.arrayBuffer();

    return {
        inlineData: {
            data: Buffer.from(imageResp).toString("base64"),
            mimeType,
        },
    };
}

export default async function fetch_insight(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Check auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({error: "Unauthorized"});
    }

    const { imageUrls } = req.body;
    if (!imageUrls || imageUrls.length === 0) {
        return res.status(400).json({ error: "No image URLs provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const docRef = db.collection("users").doc(uid);
        const userData = await docRef.get(); // Await this to resolve the promise

        const membership = userData.get("membership");

        if (membership < 1) {
            return res.status(401).json({error: "Invalid membership"});
        }

        // You may need to update the file paths
        const images = await Promise.all(imageUrls.map(fileToGenerativePart));

        const chatSession = model.startChat({
            generationConfig,
        });

        const result = await chatSession.sendMessage(images);
        return res.status(200).json(result);
    } catch (error) {
        console.log("Error verifying token:", error);
        return res.status(401).json({error: "Invalid token"});
    }
}