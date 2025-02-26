import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

export default async function request_match(req, res) {
    if (req.method !== 'POST') {
        console.error("Method not allowed");
        return res.status(405).json({error: 'Method not allowed'});
    }

    // check auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error('Unauthorized');
        return res.status(401).json({ error: "Unauthorized" });
    }

    let { matchpoolIdx } = req.body;
    if (!matchpoolIdx) {
        return res.status(401).json({ error: "Missing matchpoolId" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        let uid = decodedToken.uid;

        // get the firestore document of the current user
        const selfDocRef = db.collection("users").doc(uid);
        let selfData = await selfDocRef.get();

        let desiredMatchUID = selfData.get("matchpool")[matchpoolIdx].uid;

        const otherDocRef = db.collection("users").doc(desiredMatchUID);

        // only add it if it doesn't exist in outgoingMatches
        let outgoingMatches = selfData.get("outgoingMatches");
        for (let i = 0; i < outgoingMatches.length; i++) {
            let uid = outgoingMatches[i];
            if (uid === desiredMatchUID) {
                return res.status(500).json({ error: "Already requested match for this user" });
            }
        }

        // check if incoming matches already has the other user, then create a chatroom
        let incomingMatches = selfData.get("incomingMatches");
        for (let i = 0; i < incomingMatches.length; i++) {
            let uid = incomingMatches[i];
            if (uid === desiredMatchUID) {
                // create chatroom
            }
        }

    } catch (error) {
        console.error("Error verifying token:", error);
        return res.status(401).json({ error: "Invalid token" });
    }
}