import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

export default async function send_message(req, res) {
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

    let {otherUID, message} = req.body;

    if (!otherUID || !message) {
        console.error("Missing required fields");
        return res.status(401).json({error: "Missing chatroom or message"});
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        let uid = decodedToken.uid;

        // the chatroom id is the smaller uid + the larger uid
        let chatroomID = [uid, otherUID].sort().join("-");
        // get the doc of the chatroom
        const chatroomDocRef = db.collection("chats").doc(chatroomID);
        let chatroomData = await chatroomDocRef.get();
        // check if the chatroom exists
        if (!chatroomData.exists) {
            console.error("Chatroom does not exist");
            return res.status(404).json({error: "Chatroom does not exist"});
        }

        // check the message limit for the user
        const selfDocRef = db.collection("users").doc(uid);
        let selfData = await selfDocRef.get();
        let membership = selfData.get("membership");

        // check if the message is changing the chat type
        if (message.startsWith("[SET_CHAT_TYPE]")) {
            let chatType = message.split("[SET_CHAT_TYPE]")[1];
            if (chatType !== "business" && chatType !== "dating") {
                return res.status(500).json({error: "Invalid chat type"});
            }
            let selfChatroomData = chatroomData.get(uid + "-data");
            selfChatroomData.mode = chatType;
            let updatedSelfChatroomData = {
                [uid + "-data"]: selfChatroomData,
            }
            await chatroomDocRef.update(updatedSelfChatroomData);
            return res.status(200).json({message: "Chat type updated"});
        }

        if (membership === 0 && chatroomData.get(uid + "-data").messageLimit === 0) {
            return res.status(500).json({error: "Message limit reached"});
        }
        // check if the message is empty
        if (message.trim() === "") {
            return res.status(500).json({error: "Message cannot be empty"});
        }
        // check if the message is too long
        if (message.length > 500) {
            return res.status(500).json({error: "Message too long"});
        }

        let msgObj = {
            sender: selfData.get("displayName"),
            message: message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }

        // update the chatroom messages field with the new message
        let messages = chatroomData.get("messages");
        messages.push(msgObj);
        let updatedChatroomData = {
            messages: messages,
        }
        await chatroomDocRef.update(updatedChatroomData);
        // update the message limit for the user
        if (membership === 0) {
            let selfChatroomData = chatroomData.get(uid + "-data");
            selfChatroomData.messageLimit--;
            let updatedSelfChatroomData = {
                [uid + "-data"]: selfChatroomData,
            }
            await chatroomDocRef.update(updatedSelfChatroomData);
        }


    } catch (error) {
        console.error("Error verifying token:", error);
        return res.status(401).json({error: "Unauthorized"});
    }
}