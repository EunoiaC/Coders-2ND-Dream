// This function returns all users for a given plan and all possible specific data for that plan.
// - Salesforce Worker and higher subscriptions get mutual github repo info

// Check subscription payment status

/* Free tier
    - Load five users
    - Add a timestamp to user after successful retrieval, this will be used to check if the function is called again and the user is
      eligible for more matches
    - On client-side, prevent click of start-matching button if the timestamp is within the last week
 */

import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

async function loadSimple(userData, doc, numUsers, secondsLimit) {
    let run = false;

    let seconds = 0
    if (!userData.get("lastFetch")) { // check if the timestamp existed
        run = true;
    } else {
        const now = new Date();
        let timestamp = userData.get("lastFetch").toDate();
        const timeDiff = now - timestamp; // Difference in milliseconds

        seconds = Math.floor(timeDiff / 1000);

        if (seconds > secondsLimit) {
            run = true; // only let free tier fetch again if it's been a week
        }
    }

    if (run) {

        const maxSeed = Number.MAX_VALUE; // 1 less than 10 bil
        const ranges = {
            0: { min: 0, max: maxSeed / 3 }, // FRONT_END
            1: { min: maxSeed / 3, max: maxSeed/3 }, // BACK_END
            2: { min: maxSeed/3, max: maxSeed } // FULL_STACK
        };

        const lookingFor = userData.get("lookingFor");
        const { min, max } = ranges[lookingFor];

        let users = new Map(); // list of uids, in map format to prevent duplicates

        // TODO: instead of for loop, just use one query?
        // get 5 random documents by finding each one closest to the match seed
        // generate a random number between min and max
        let random = Math.floor(Math.random() * (max - min + 1) + min);

        const matchesQuery = await db.collection("users")
            .where("matchSeed", ">=", random)
            .where(admin.firestore.FieldPath.documentId(), "!=", doc.id)
            .orderBy("matchSeed")
            .limit(numUsers)
            .get();
        for (let i = 0; i < matchesQuery.docs.length; i++) {
            let doc = matchesQuery.docs[i];
            let data = doc.data();
            delete data.matchpool; // dont return the matchpool, sensitive info
            delete data.lastFetch; // dont return their lastFetch either
            delete data.matchSeed; // dont need their matchseed
            users.set(doc.id, data);
        }


        // update the timestamp in the doc and currently matching users
        await doc.update({
            lastFetch: admin.firestore.FieldValue.serverTimestamp(),
            matchpool: Array.from(users.keys()),
        });

        return {users: Array.from(users.keys()), loadedData: Array.from(users.values())};
    } else {
        // return a message that it's been too close since the last attempt, and return cached match pool
        let secondsLeft = secondsLimit - seconds;
        return {users: userData.get("matchpool"), message: `You have ${Math.floor(secondsLeft/3600)} hours left until you receive a new match pool.`};
    }
}

async function loadAPCSAGod(uid, userData, doc, filter, lastDoc) {
    // just fetch most recent 20 active users (by last fetch) in pagination 20 -> 20 * (page + 1)
    const query = db.collection("users")
        .orderBy("lastFetch", "desc")
        .where(admin.firestore.FieldPath.documentId(), '!=', uid)
        .limit(20);
    if (lastDoc) {
        query.startAfter(lastDoc);
    }
    const snapshot = await query.get();
    const users = snapshot.docs.map(doc => ({
        uid: doc.id, // uids are not stored in the matchpool, so we must always retrieve them
        ...doc.data()
    }));

    // console.log(users);

    const lastDocument = snapshot.docs[snapshot.docs.length - 1];

    await doc.update({
        lastFetch: admin.firestore.FieldValue.serverTimestamp(),
    }); // update to keep user active

    return {
        loadedData: users,
        lastDoc: lastDocument ? lastDocument.data() : null,
    }
}

// Main API handler
export default async function fetch_users(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Check auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({error: "Unauthorized"});
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const docRef = db.collection("users").doc(uid);
        const userData = await docRef.get(); // Await this to resolve the promise

        // if (!userData.exists) {
        //     return res.status(404).json({ error: "User not found" });
        // }

        const membership = userData.get("membership");

        if (membership === 0) {
            const result = await loadSimple(userData, docRef, 5, 604800); // Await properly
            return res.status(200).json(result);
        }

        // TODO: since membership is more than free, check if membership is valid or unpaid

        switch (userData.get("membership")) {
            case 1:
                // for now, load free
                const internResult = await loadSimple(userData, docRef, 10, 86400); // Await properly
                return res.status(200).json(internResult);
            case 2:
                break;
            case 3:
                const { filter, lastDoc } = req.body;
                const result = await loadAPCSAGod(uid, userData, docRef, filter, lastDoc); // Await properly
                return res.status(200).json(result);
            default:
                return res.status(400).json({error: "Invalid membership type"});
        }
    } catch (error) {
        console.log("Error verifying token:", error);
        return res.status(401).json({error: "Invalid token"});
    }
}