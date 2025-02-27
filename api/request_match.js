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

        // give an error if the user already requested a match for this user
        let outgoingRequests = selfData.get("outgoingRequests");
        for (let i = 0; i < outgoingRequests.length; i++) {
            let uid = outgoingRequests[i];
            if (uid === desiredMatchUID) {
                return res.status(500).json({ error: "Already tried pulling this user" });
            }
        }

        // update outgoing match stats
        outgoingRequests.push(desiredMatchUID);
        let updatedSelfStats = {
            outgoingRequests: outgoingRequests,
        }
        await selfDocRef.update(updatedSelfStats);

        // check if incoming matches already has the other user, then create a chatroom
        let incomingRequests = selfData.get("incomingRequests");
        for (let i = 0; i < incomingRequests.length; i++) {
            if (incomingRequests[i] === desiredMatchUID) {
                // create chatroom
                let chatId = null;

                if (uid < desiredMatchUID) {
                    chatId = uid + "-" + desiredMatchUID;
                } else {
                    chatId = desiredMatchUID + "-" + uid;
                }

                // TODO: create a chat document

                return res.status(200).json({ chatroom: chatId });
            }
        }

        // at this point in the code, it's just a regular match request
        // get the desired user, and update their incoming requests
        let desiredMatchDocRef = db.collection("users").doc(desiredMatchUID);
        let desiredMatchData = await desiredMatchDocRef.get();

        let desiredIncomingReqs = desiredMatchData.get("incomingRequests");
        desiredIncomingReqs.push(uid);

        let updatedDesiredStats = {
            incomingRequests: desiredIncomingReqs
        }

        await desiredMatchDocRef.update(updatedDesiredStats);

        return res.status(200).json(); // to update aura in the clientside
    } catch (error) {
        console.error("Error verifying token:", error);
        return res.status(401).json({ error: "Invalid token" });
    }
}