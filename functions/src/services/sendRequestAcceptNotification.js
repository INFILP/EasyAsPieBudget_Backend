const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

const AcceptFamilyMemberRequest = functions.https.onCall(
  async (data, context) => {
    try {
      const { requestSenderId, requestRceiverUserName } = data;

      const userDataFirestoreObject = await admin
        .firestore()
        .collection("users")
        .doc(requestSenderId)
        .get();
      if (!userDataFirestoreObject.exists)
        return { error: "No user found", response: null };

      if (userDataFirestoreObject) {
        // send notification to user

        const userData = userDataFirestoreObject.data();
        const message = {
          to: userData.notificationToken,
          sound: "default",
          title: "Group Request Accepted",
          body: `${requestRceiverUserName} has accepted your request to join family group`,
          data: { someData: "" },
        };

        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });

        return { error: null, response: `Notification sent to ${user.email}` };
      }
    } catch (ex) {
      return { error: ex.message, response: null };
    }
  }
);

module.exports = AcceptFamilyMemberRequest;
