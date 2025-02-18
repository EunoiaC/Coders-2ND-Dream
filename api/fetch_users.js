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

async function loadFree(userData, doc) {
    let run = false;

    if (!userData.get("lastFetch")) { // check if the timestamp existed
        run = true;
    } else {
        const now = new Date();
        let timestamp = userData.get("lastFetch").toDate();
        const timeDiff = now - timestamp; // Difference in milliseconds

        const seconds = Math.floor(timeDiff / 1000);

        if (seconds > 604800) { // seconds in a week
            run = true; // only let free tier fetch again if it's been a week
        }
    }

    if (run) {

        let docNumSnap = await db.collection("users").count().get();
        let docNum = docNumSnap.data().count;

        const maxSeed = Number.MAX_VALUE; // 1 less than 10 bil
        const ranges = {
            0: { min: 0, max: maxSeed / 3 }, // FRONT_END
            1: { min: maxSeed / 3, max: maxSeed/3 }, // BACK_END
            2: { min: maxSeed/3, max: maxSeed } // FULL_STACK
        };

        const requiredAmnt = 5;
        const lookingFor = userData.get("lookingFor");
        const { min, max } = ranges[lookingFor];

        // TODO: remove b/c this is for testing
        // if (docNum <= requiredAmnt) {
        //     startAtVal = min;
        // }

        let users = new Map(); // use a map because if a second query is made, overlapping users will be accounted for

        // get 5 random documents by finding each one closest to the match seed
        for (let i = 0; i < requiredAmnt; i++) {
            // generate a random number between min and max
            let random = Math.floor(Math.random() * (max - min + 1) + min);

            const matchesQuery = await db.collection("users")
                .where("matchSeed", ">=", random)
                .orderBy("matchSeed")
                .limit(1)
                .get();
            let doc = matchesQuery.docs[0];
            users.set(doc.id, doc.data());
        }

        // add loaded UIDs to the user's document to show who they can match with
        let uids = Array.from(users.keys());

        // update the timestamp in the doc and currently matching users
        await doc.update({
            lastFetch: admin.firestore.FieldValue.serverTimestamp(),
            currentMatchPool: uids
        });

        return Array.from(users.values());
    } else {
        // return that it's been too close since the last attempt
        return { error: "Wait at least a week before trying again." };
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
        return res.status(401).json({ error: "Unauthorized" });
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
            const result = await loadFree(userData, docRef); // Await properly
            return res.status(200).json(result);
        }

        // TODO: since membership is more than free, check if membership is valid or unpaid

        switch (userData.get("membership")) {
            case 1:

            default:
                return res.status(400).json({ error: "Invalid membership type" });
        }
    } catch (error) {
        console.error("Error verifying token:", error);
        return res.status(401).json({ error: "Invalid token" });
    }
}