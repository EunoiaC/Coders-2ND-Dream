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
        console.error("Method not allowed");
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // check auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error('Unauthorized');
        return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    const { displayName, bday, selfCapabilities, lookingFor, matchSeed, knownLangs, pfpLink } = req.body;

    if (!displayName || !bday || !selfCapabilities || !lookingFor || !matchSeed || !knownLangs || !pfpLink) {
        console.error('Incorrect arguments');
        return res.status(400).json({ message: 'Incorrect passed values' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        let uid = decodedToken.uid;

        const vals = {
            displayName: displayName,
            bday: bday,
            selfCapabilities: selfCapabilities,
            lookingFor: lookingFor,
            matchSeed: matchSeed,
            knownLangs: knownLangs,
            pfpLink: pfpLink,
            readme: "# Edit your README!",
            pfpVersion: 0,
            customButton: null,
            // selfRequestedMatches: 0,
            // otherRequestedMatches: 0,
            // successfulMatches: 0,
            membership: 0, // tier 0 membership (free)
            outgoingRequests: [],
            incomingRequests: [],
            matchpool: [],
            lastFetch: null
        }

        const docRef = db.collection("users").doc(uid);
        try {
            await docRef.set(vals);
            return res.status(200).json(vals);
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: e });
        }

    } catch (error) {
        console.error("Error verifying token:", error);
        return res.status(401).json({ error: "Invalid token" });
    }
}
