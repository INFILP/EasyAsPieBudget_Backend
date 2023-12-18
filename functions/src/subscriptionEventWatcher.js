const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
// const plansAccess = {
//   // Disabled from stores
//   eap_199_1m_1m199: {
//     isGroupAdmin: false,
//     isPlanActive: true,
//   },
//   eap_799_1m_1m799: {
//     isGroupAdmin: true,
//     isPlanActive: true,
//   },

//   // Pro Version
//   eap_599_1m_1m599: {
//     isGroupAdmin: false,
//     isPlanActive: true,
//   },
//   "eap_599_1y_1y599:eap-599-1y-1y599": {
//     isGroupAdmin: false,
//     isPlanActive: true,
//   },

//   // Family Version
//   eap_999_1m_1m999: {
//     isGroupAdmin: true,
//     isPlanActive: true,
//   },
//   "eap_999_1y_1y999:eap-999-1y-1y999": {
//     isGroupAdmin: true,
//     isPlanActive: true,
//   },
// };

let groupData = {
  authorId: "",
  members: {
    // [uuid]: user.email,
  },
};

const SubscriptionEventWatcher = functions.firestore
  .document("webhook/{userId}")
  .onCreate(async (snap, context) => {
    // Get an object representing the document
    const data = snap.data();
    console.log(data);

    if (data.type === "CANCELLATION") {
      console.log(
        `User: ${data.app_user_id} canceling subscription to ${
          data.product_id
        } from ${data.store} at ${new Date().toISOString()}`
      );

      let groupData = await admin
        .firestore()
        .collection("familyGroups")
        .doc(data.app_user_id)
        .get();

      groupData = groupData.data() ?? {};

      let groupMembers = groupData?.members;
      let updateMembersPlanPromiseArray = [];

      if (groupMembers) {
        // Setting the member group id back to original and role back to admin
        // This way if they have their plan active it will not affect them
        updateMembersPlanPromiseArray = Object.keys(groupMembers).map(
          (memberId) =>
            admin
              .firestore()
              .collection("users")
              .doc(memberId)
              .update({
                group: {
                  id: memberId,
                  role: "admin",
                },
              })
        );

        await Promise.all(updateMembersPlanPromiseArray);
      }

      let userData = await admin.auth().getUser(data.app_user_id);

      groupData.members = {
        [`${data.app_user_id}`]: {
          email: userData.email,
          name: userData.displayName,
        },
      };

      await admin
        .firestore()
        .collection("familyGroups")
        .doc(data.app_user_id)
        .update(groupData);

      return admin
        .firestore()
        .collection("users")
        .doc(data.app_user_id)
        .update({
          group: {
            id: data.app_user_id,
            role: "admin",
          },
          ["plan.active"]: false,
          ["plan.name"]: "free",
          ["plan.endAt"]: new Date(),
        });
    } else if (data.type == "INITIAL_PURCHASE") {
      console.log(
        `User: ${data.app_user_id} subscribing to ${data.product_id} from ${
          data.store
        } at ${new Date().toISOString()}`
      );

      // if it is solo Version
      if (
        data.product_id == "eap_599_1m_1m599" ||
        data.product_id == "eap_599_1y_1y599:eap-599-1y-1y599"
      ) {
        console.log("Product is Solo Version");
        return await admin
          .firestore()
          .collection("users")
          .doc(data.app_user_id)
          .update({
            group: {
              id: data.app_user_id,
              role: "admin",
            },
            ["plan.active"]: true,
            ["plan.name"]: data.product_id,
            ["plan.startedAt"]: new Date(),
          });
      }

      //  if it is group version
      else if (
        data.product_id == "eap_999_1m_1m999" ||
        data.product_id == "eap_999_1y_1y999:eap-999-1y-1y999"
      ) {
        console.log("Product is Group Version");
        await admin
          .firestore()
          .collection("users")
          .doc(data.app_user_id)
          .update({
            group: {
              id: data.app_user_id,
              role: "admin",
            },
            ["plan.active"]: true,
            ["plan.name"]: data.product_id,
            ["plan.startedAt"]: new Date(),
          });

        let userData = await admin.auth().getUser(data.app_user_id);

        groupData.authorId = data.app_user_id;
        groupData.members[`${data.app_user_id}`] = {
          email: userData.email,
          name: userData.displayName,
        };

        // const message = {
        //   to: memberToRequestData.notificationToken,
        //   sound: "default",
        //   title: "Subscription Activation",
        //   body: `Your subscription is now active!`,
        //   data: { someData: "", path: "notificationscreen" },
        // };

        // await fetch("https://exp.host/--/api/v2/push/send", {
        //   method: "POST",
        //   headers: {
        //     Accept: "application/json",
        //     "Accept-encoding": "gzip, deflate",
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify(message),
        // });

        return admin
          .firestore()
          .collection("familyGroups")
          .doc(data.app_user_id)
          .set(groupData);
      }
    }
    // for iOS initial purchase
    else if (data.type == "TRANSFER") {
    } else if (data.type == "RENEWAL") {
      console.log(
        `User: ${data.app_user_id} renewel subscription to ${
          data.product_id
        } from ${data.store} at ${new Date().toISOString()}`
      );

      return await admin
        .firestore()
        .collection("users")
        .doc(data.app_user_id)
        .update({
          group: {
            id: data.app_user_id,
            role: "admin",
          },
          ["plan.active"]: true,
          ["plan.name"]: data.product_id,
          ["plan.startedAt"]: new Date(),
        });
    } else if (data.type == "EXPIRATION") {
      return console.log(
        `User: ${data.app_user_id} expiration subscription to ${
          data.product_id
        } from ${data.store} at ${new Date().toISOString()}`
      );
    } else {
      return console.log(
        `User: ${data.app_user_id} ${data.type} to ${data.product_id} from ${
          data.store
        } at ${new Date().toISOString()}`
      );
    }
  });

module.exports = SubscriptionEventWatcher;
