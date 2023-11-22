const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

const AddFamilyMember = functions.https.onCall(async (data, context) => {
  try {
    const { email, groupId, status } = data;
    functions.logger.log(email, groupId, status);

    if (email == context.auth.token.email)
      return {
        error: "You cannot add yourself to your family group",
        response: null,
      };

    const memberToRequest = await admin.auth().getUserByEmail(email);
    const requestSender = await admin.auth().getUser(context.auth.uid);

    const memberToRequestFiretoreObject = await admin
      .firestore()
      .collection("users")
      .doc(`${memberToRequest.uid}`)
      .get();

    functions.logger.log("fetched userFiretoreObject");

    if (memberToRequestFiretoreObject) {
      functions.logger.log("There is a user");
      const memberToRequestData = memberToRequestFiretoreObject.data();

      //  if user is already part of a group return error
      if (memberToRequestData.group.role == "member") {
        functions.logger.log("User is already a member");
        return {
          error: "User is already a member of a group",
          response: null,
        };
      }
      // else if (memberToRequestData.isGroupAdmin) {
      //   functions.logger.log("User is already an admin");
      //   const userGroupDataFireStoreObject = await admin
      //     .firestore()
      //     .collection("familyGroups")
      //     .doc(memberToRequestData.myGroupId)
      //     .get();

      //   const userGroupData = userGroupDataFireStoreObject.data();
      //   if (Object.keys(userGroupData.members).length > 1)
      //     return {
      //       error: "User is already a group admin",
      //       response: null,
      //     };
      //   else {
      //     // send notification to user
      //     const message = {
      //       to: memberToRequestData.notificationToken,
      //       sound: "default",
      //       title: "Family Group Request",
      //       body: `${requestSender.displayName} has sent you a request to join family group`,
      //       data: { someData: "", path: "notificationscreen" },
      //     };

      //     await fetch("https://exp.host/--/api/v2/push/send", {
      //       method: "POST",
      //       headers: {
      //         Accept: "application/json",
      //         "Accept-encoding": "gzip, deflate",
      //         "Content-Type": "application/json",
      //       },
      //       body: JSON.stringify(message),
      //     });

      //     functions.logger.log(
      //       "Notification sent to " +
      //         memberToRequest.email +
      //         " expoID: " +
      //         memberToRequestData.notificationToken
      //     );

      //     await admin
      //       .firestore()
      //       .collection("familyGroupRequests")
      //       .add({
      //         timeStamp: admin.firestore.FieldValue.serverTimestamp(),
      //         groupId,
      //         userId: memberToRequest.uid,
      //         userEmail: memberToRequest.email,
      //         requestSenderId: requestSender.uid,
      //         requestSenderEmail: requestSender.email,
      //         status,
      //         type: "familyGroupRequest",
      //         title: "Family Group Request",
      //         message: `${requestSender.displayName} has sent you a request to join family group`,
      //       });

      //     return {
      //       response: `Notification sent to ${memberToRequest.email}`,
      //       error: null,
      //     };
      //   }
      // }
      else {
        // if user is not part of the group send request
        // send notification to user
        const message = {
          to: memberToRequestData.notificationToken,
          sound: "default",
          title: "Family Group Request",
          body: `${requestSender.displayName} has sent you a request to join family group`,
          data: { someData: "", path: "notificationscreen" },
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

        functions.logger.log("Sending request to user");
        const currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() + 1);

        await admin
          .firestore()
          .collection("familyGroupRequests")
          .add({
            timeStamp: admin.firestore.FieldValue.serverTimestamp(),
            groupId,
            userId: memberToRequest.uid,
            userEmail: memberToRequest.email,
            requestSenderId: requestSender.uid,
            requestSenderEmail: requestSender.email,
            status,
            type: "familyGroupRequest",
            title: "Family Group Request",
            message: `${requestSender.displayName} has sent you a request to join family group`,
            expireAt: currentDate,
          });

        return {
          response: `Notification sent to ${memberToRequest.email}`,
          error: null,
        };
      }
    } else return { error: "No user found", response: null };
  } catch (ex) {
    functions.logger.log(ex.message);
    return { error: ex.message, response: null };
  }
});

module.exports = AddFamilyMember;
