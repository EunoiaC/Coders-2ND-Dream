import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from "@google/generative-ai";
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

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: "When given a string of text messages, you must review each message and give it a label, explaining why in context of all messages. The outputted list MUST EQUAL the size of the input messages. Follow the rules of texting theory. You will be given messages and which user is asking for the review. \n\nmoves are as following:\nBrilliant: Indicates an exceptionally insightful or clever message.\nBest: Denotes the optimal or most appropriate message in the given context.\nExcellent: Signifies a very good message that effectively advances the conversation.\nGood: Represents a solid message that contributes positively to the dialogue.\nBook: Refers to a standard or commonly used message, often neutral in impact.\nInaccuracy: Marks a message that isn't the best choice and could have been improved.\nMistake: Highlights a message that detracts from the conversation or is suboptimal.\nBlunder: Indicates a significantly poor message that negatively affects the interaction.\nMissed Win: Denotes a missed opportunity where a better message could have led to a more favorable outcome.\nForced: Represents a message that was the only viable option in the context.\nCheckmate: Signifies a decisive message that concludes the conversation effectively.\nResignation: Indicates a message where the sender concedes or gives up in the conversation.\n\nPlease make sure you write something for EACH message, even if it's a simple thing.",
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
            moves: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        move_type: {
                            type: "string"
                        },
                        explanation: {
                            type: "string"
                        }
                    },
                    required: [
                        "move_type",
                        "explanation"
                    ]
                }
            }
        },
        required: [
            "moves"
        ]
    },
};

export default async function message_review(req, res) {
    if (req.method !== 'POST') {
        console.error("Method not allowed");
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({error: "Unauthorized"});
    }

    const { messages } = req.body;

    if (!messages) {
        console.error("Missing required fields");
        return res.status(401).json({ error: "Missing messages" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const docRef = db.collection("users").doc(uid);
        const userData = await docRef.get(); // Await this to resolve the promise

        const membership = userData.get("membership");

        if (membership === 0) {
            return res.status(403).json({ error: "User is too low tiered" });
        }

        let modelInput = "\"perspective: " + userData.get("displayName") + "\"\n";
        for (let i = 0; i < messages.length; i++) {
            let message = messages[i];
            modelInput += "\"" + message.sender + ": " + message.message + "\"\n";
        }

        const chatSession = model.startChat({
            generationConfig,
            history: [
                {
                    role: "user",
                    parts: [
                        {text: "\"perspective: Bob\"\n\"Sam: hello\"\n\"Bob: u stupid\"\n\"Sam: :(\"\n\"Bob: hehe\""},
                    ],
                },
                {
                    role: "model",
                    parts: [
                        {text: "{\n  \"moves\": [\n    {\n      \"explanation\": \"\\\"hello\\\" is a standard opening. Nothing special.\",\n      \"move_type\": \"Book\"\n    },\n    {\n      \"explanation\": \"\\\"u stupid\\\" is unnecessarily rude and escalates the situation negatively.\",\n      \"move_type\": \"Blunder\"\n    },\n    {\n      \"explanation\": \"\\\":(\\\" expresses sadness in response to the insult.\",\n      \"move_type\": \"Book\"\n    },\n    {\n      \"explanation\": \"\\\"hehe\\\" is dismissive and continues the negative interaction.\",\n      \"move_type\": \"Mistake\"\n    }\n  ]\n}"},
                    ],
                },
            ],
        });

        const result = await chatSession.sendMessage(modelInput);

        return res.status(200).json({
            moves: result.response.text()
        });
    } catch (error) {
        console.error("Error generating message review:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}