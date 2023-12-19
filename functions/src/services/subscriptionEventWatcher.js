const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const helper = require("../utils/helper");

const subscriptionPlans = {
  // Disabled from stores
  eap_199_1m_1m199: {
    id: "eap_199_1m_1m199",
    name: "",
  },
  eap_799_1m_1m799: {
    id: "eap_799_1m_1m799",
    name: "",
  },

  // Pro Version
  eap_599_1m_1m599: {
    id: "eap_599_1m_1m599",
    name: "Solo Gold",
    product_id: "eap_599_1m_1m599",
  },
  // iOS Product ID
  eap_599_1y_1y599: {
    id: "eap_599_1y_1y599",
    name: "Solo Premium",
    product_id: "eap_599_1y_1y599",
  },
  // Android Product ID
  "eap_599_1y_1y599:eap-599-1y-1y599": {
    id: "eap_599_1y_1y599",
    name: "Solo Premium",
    product_id: "eap_599_1y_1y599:eap-599-1y-1y599",
  },

  // Family Version
  eap_999_1m_1m999: {
    id: "eap_999_1m_1m999",
    name: "Group Gold",
    product_id: "eap_999_1m_1m999",
  },
  // iOS Product ID
  eap_999_1y_1y999: {
    id: "eap_999_1y_1y999",
    name: "Group Premium",
    product_id: "eap_999_1y_1y999",
  },
  // Android Product ID
  "eap_999_1y_1y999:eap-999-1y-1y999": {
    id: "eap_999_1y_1y999",
    name: "Group Premium",
    product_id: "eap_999_1y_1y999:eap-999-1y-1y999",
  },
};

const SubscriptionEventWatcher = functions.firestore
  .document("webhook/{userId}")
  .onCreate(async (snap, context) => {
    // Get an object representing the document
    const data = snap.data();
    // console.log(data);

    // This is user for varius cases also cancellation by user
    if (data.type === "EXPIRATION") {
      console.log(
        `User: ${data.app_user_id} subscription to ${
          data.product_id
        } expired due do ${data.e}from ${
          data.store
        } at ${new Date().toISOString()}`
      );

      let groupData = await admin
        .firestore()
        .collection("familyGroups")
        .doc(data.app_user_id)
        .get();

      if (groupData.exists) groupData = groupData.data();
      else
        groupData = {
          members: {},
        };

      // If there are members in the group
      if (groupData?.members && Object.keys(groupData?.members).length > 0) {
        let groupMembers = Object.keys(groupData?.members);
        let updateMembersPlanPromiseArray = [];

        groupMembers = groupMembers.filter((uid) => uid != data.app_user_id);

        // Setting the member group id back to original and role back to admin
        // This way if they have their plan active it will not affect them
        updateMembersPlanPromiseArray = groupMembers.map((memberId) =>
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

      let userData = await admin
        .firestore()
        .collection("users")
        .doc(data.app_user_id)
        .get();

      userData = userData.data();

      groupData.members = {
        [`${data.app_user_id}`]: {
          email: userData.email,
          name: userData.name,
        },
      };

      await admin
        .firestore()
        .collection("familyGroups")
        .doc(data.app_user_id)
        .update(groupData);

      await admin
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

      if (userData.notificationToken) {
        let body = "";

        switch (data.expiration_reason) {
          case "UNSUBSCRIBE":
            body = `Your ${
              subscriptionPlans[data.product_id].name
            } subscription is cancelled!`;
            break;
          case "BILLING_ERROR":
            body = `Your ${
              subscriptionPlans[data.product_id].name
            } subscription is not activated due to some billing error! Any amount taken from you will be refunded by the store`;
            break;
          case "SUBSCRIPTION_PAUSED":
            body = `Your ${
              subscriptionPlans[data.product_id].name
            } subscription is cancelled as you have paused the subscription`;
            break;
          case "UNKNOWN":
            body = `Your ${
              subscriptionPlans[data.product_id].name
            } subscription is not de-activated due to some error! Any amount taken from you will be refunded by the store`;
            break;
        }

        const message = {
          to: userData.notificationToken,
          sound: "default",
          title: "Subscription Cancelled",
          body: body,
          data: { someData: "", path: "notificationscreen" },
        };

        await helper.sendNotificaion(message);
      }

      return;
    } else if (
      data.type == "INITIAL_PURCHASE" ||
      data.type == "UNCANCELLATION"
    ) {
      console.log(
        `User: ${data.app_user_id} subscribing to ${data.product_id} from ${
          data.store
        } at ${new Date().toISOString()}`
      );

      // if it is solo Version
      if (
        data.product_id == subscriptionPlans["eap_599_1m_1m599"].product_id ||
        data.product_id ==
          subscriptionPlans["eap_599_1y_1y599:eap-599-1y-1y599"].product_id
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
            ["plan.name"]: subscriptionPlans[data.product_id].id,
            ["plan.startedAt"]: new Date(),
          });
      }

      //  if it is group version
      else if (
        data.product_id == subscriptionPlans["eap_999_1m_1m999"].product_id ||
        data.product_id ==
          subscriptionPlans["eap_999_1y_1y999:eap-999-1y-1y999"].product_id
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
            ["plan.name"]: subscriptionPlans[data.product_id].id,
            ["plan.startedAt"]: new Date(),
          });

        // await admin.auth().getUser(data.app_user_id);
        let userData = await admin
          .firestore()
          .collection("users")
          .doc(data.app_user_id)
          .get();

        userData = userData.data();

        let groupData = {
          authorId: data.app_user_id,
          members: {},
        };

        groupData.members[`${data.app_user_id}`] = {
          email: userData.email,
          name: userData.name,
        };

        await admin
          .firestore()
          .collection("familyGroups")
          .doc(data.app_user_id)
          .set(groupData);

        if (userData.notificationToken) {
          const message = {
            to: userData.notificationToken,
            sound: "default",
            title: "Subscription Activation",
            body: `Your ${
              subscriptionPlans[data.product_id].name
            } subscription is now active!`,
            data: { someData: "", path: "notificationscreen" },
          };

          await helper.sendNotificaion(message);
        }

        return;
      }
    } else if (data.type == "RENEWAL") {
      console.log(
        `User: ${data.app_user_id} renewel subscription to ${
          data.product_id
        } from ${data.store} at ${new Date().toISOString()}`
      );

      let userData = await admin
        .firestore()
        .collection("users")
        .doc(data.app_user_id)
        .get();

      userData = userData.data();

      await admin
        .firestore()
        .collection("familyGroups")
        .doc(data.app_user_id)
        .update(groupData);

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
          ["plan.name"]: subscriptionPlans[data.product_id].id,
          ["plan.startedAt"]: new Date(),
        });

      if (userData.notificationToken) {
        const message = {
          to: userData.notificationToken,
          sound: "default",
          title: "Subscription Renewal",
          body: `Your ${
            subscriptionPlans[data.product_id].name
          } subscription is renewed!`,
          data: { someData: "", path: "notificationscreen" },
        };

        await helper.sendNotificaion(message);
      }

      return;
    } else {
      return console.log(
        `User: ${data.app_user_id} ${data.type} to ${data.product_id} from ${
          data.store
        } at ${new Date().toISOString()}`
      );
    }
  });

module.exports = SubscriptionEventWatcher;
