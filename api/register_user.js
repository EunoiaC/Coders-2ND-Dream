import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

// Main API handler
export default async function register_user(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // check auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        let uid = decodedToken.uid;

        let docNumSnap = await db.collection("users").count().get();
        let docNum = docNumSnap.data().count;

        const docRef = db.collection("users").doc(uid);
        try {
            await docRef.update({
                selfRequestedMatches: 0,
                otherRequestedMatches: 0,
                successfulMatches: 0,
                membership: 0, // tier 0 membership (free)
                userIdx: docNum - 1 // subtract 1 because the user already has their own document; we need start at zero indexing
            });
            return res.status(200).json();
        } catch (e) {
            return res.status(500).json({ error: e });
        }

    } catch (error) {
        console.error("Error verifying token:", error);
        return res.status(401).json({ error: "Invalid token" });
    }
}
