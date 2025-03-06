import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

function calculateMessageLimit(membership) {
    switch (membership) {
        case 0:
            return 5; // Free tier: only 5 message features per chat (message features include regular messages, programming games, icebreakers, etc)
        case 1:
            return 20; // Tier 1
        default:
            return null; // Remaining tiers are unlimited
    }
}

export default async function request_match(req, res) {
    if (req.method !== 'POST') {
        console.error("Method not allowed");
        return res.status(405).json({error: 'Method not allowed'});
    }

    // check auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error('Unauthorized');
        return res.status(401).json({error: "Unauthorized"});
    }

    let { desiredMatchUID } = req.body;

    if (!desiredMatchUID) {
        console.error("Missing required fields");
        return res.status(401).json({ error: "Missing desiredMatchUID" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        let uid = decodedToken.uid;

        // get the firestore document of the current user
        const selfDocRef = db.collection("users").doc(uid);
        let selfData = await selfDocRef.get();

        // first validate that desiredMatchUID is in the matchpool OR incoming requests
        let matchpool = selfData.get("matchpool");
        let incomingReqs = selfData.get("incomingRequests");
        let membership = selfData.get("membership");
        // the uid must be in either the matchpool or incoming requests (unless membership is 3), otherwise return an error
        if (membership !== 3) {
            if (!(matchpool.includes(desiredMatchUID) || incomingReqs.includes(desiredMatchUID))) {
                return res.status(500).json({ error: "Not in matchpool" });
            }
        }

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

        // update the other user's incoming match stats
        let desiredMatchDocRef = db.collection("users").doc(desiredMatchUID);
        let desiredMatchData = await desiredMatchDocRef.get();

        let desiredIncomingReqs = desiredMatchData.get("incomingRequests");
        desiredIncomingReqs.push(uid);

        let updatedDesiredStats = {
            incomingRequests: desiredIncomingReqs
        }

        await desiredMatchDocRef.update(updatedDesiredStats);

        // check if the current user's incoming matches already has the other user, then create a chatroom
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

                let chatDocRef = db.collection("chats").doc(chatId);
                let data = {
                    messages: [],
                    users: [uid, desiredMatchUID],
                    views: 0,
                    messageLimits: {
                        [uid]: calculateMessageLimit(selfData.get("membership")),
                        [desiredMatchUID]: calculateMessageLimit(desiredMatchData.get("membership"))
                    }
                }

                await chatDocRef.set(data);

                return res.status(200).json({ chatroom: chatId });
            }
        }

        return res.status(200).json({}); // todo: update aura in the clientside
    } catch (error) {
        console.error("Error verifying token:", error);
        return res.status(401).json({ error: "Invalid token" });
    }
}