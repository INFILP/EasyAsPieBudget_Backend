const functions = require("firebase-functions");
const admin = require("firebase-admin");

const purgeUser = functions.https.onCall(async (data, context) => {
  try {
    const { email, groupId, userId } = data;
    functions.logger.log(`User: ${email} deletion started!`);

    // Delete User
    await admin.auth().deleteUser(userId);

    // Delete All User Data
    await admin.firestore().collection("users").doc(`${userId}`).delete();
    await admin
      .firestore()
      .collection("familyGroups")
      .doc(`${groupId}`)
      .delete();

    return `User: ${email} deletion completed!`;
  } catch (ex) {
    functions.logger.log(ex.message);
    return { error: ex.message, response: null };
  }
});

module.exports = purgeUser;
