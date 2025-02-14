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
        // update the timestamp in the doc
        await doc.update({
            lastFetch: admin.firestore.FieldValue.serverTimestamp(),
        });

        let docNumSnap = await db.collection("users").count().get();
        let docNum = docNumSnap.data().count;

        // choose a random number from 0 to docNum-5
        let requiredUsers = 5;
        let randomStart = Math.floor(Math.random() * (docNum - 4));

        // TODO: remove (this is only for testing)
        if (docNum <= requiredUsers) {
            randomStart = 0;
        }

        let users = new Map();  // Use a map to prevent duplicates

        // basic algorithm: only considers match type; still fetches random users
        const query1 = await db.collection("users")
            .where("selfCapabilities", '==', userData.get("lookingFor"))
            .orderBy("userIdx")
            .startAt(randomStart)
            .limit(requiredUsers);
        let snapshot1 = await query1.get(); // Get user data
        snapshot1.forEach(doc => users.set(doc.id, doc.data()));

        // fetch from the other side if not enough users
        if (users.size < requiredUsers) {
            const query2 = db.collection("users")
                .where("selfCapabilities", '==', userData.get("lookingFor"))
                .orderBy("userIdx")
                .endBefore(randomStart)
                .limit(requiredUsers - users.size);

            const snapshot2 = await query2.get();
            snapshot2.forEach(doc => users.set(doc.id, doc.data()));
        }

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