const functions = require("firebase-functions");
const admin = require("firebase-admin");

const plansAccess = {
  // Disabled from stores
  eap_199_1m_1m199: {
    isGroupAdmin: false,
    isPlanActive: true,
  },
  eap_799_1m_1m799: {
    isGroupAdmin: true,
    isPlanActive: true,
  },

  // Pro Version
  eap_599_1m_1m599: {
    isGroupAdmin: false,
    isPlanActive: true,
  },
  "eap_599_1y_1y599:eap-599-1y-1y599": {
    isGroupAdmin: false,
    isPlanActive: true,
  },

  // Family Version
  eap_999_1m_1m999: {
    isGroupAdmin: true,
    isPlanActive: true,
  },
  "eap_999_1y_1y999:eap-999-1y-1y999": {
    isGroupAdmin: true,
    isPlanActive: true,
  },
};

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
        "User: " +
          data.app_user_id +
          " canceling subscription to " +
          data.product_id +
          "from " +
          data.store
      );
      let groupData = await admin
        .firestore()
        .collection("familyGroups")
        .doc(data.app_user_id)
        .get();

      groupData = groupData.data();

      let groupMembers = groupData.members;
      let updateMembersPlanPromiseArray = [];

      //! there may a check required to set isGroupAdmin true
      //! for those who have family subscription plan and was
      //! part of this group
      updateMembersPlanPromiseArray = Object.keys(groupMembers).map(
        (memberId) =>
          admin.firestore().collection("users").doc(memberId).update({
            isGroupMember: false,
          })
      );

      await Promise.all(updateMembersPlanPromiseArray);

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
          isPlanActive: false,
          isGroupMember: false,
          isGroupAdmin: false,
          plan: "free",
        });
    } else if (data.type == "INITIAL_PURCHASE") {
      console.log(
        "User: " +
          data.app_user_id +
          " subscribing to " +
          data.product_id +
          " from " +
          data.store
      );

      // if it is Pro Version
      if (
        data.product_id == "eap_599_1m_1m599" ||
        data.product_id == "eap_599_1y_1y599:eap-599-1y-1y599"
      ) {
        console.log("Product is Pro Version");
        return await admin
          .firestore()
          .collection("users")
          .doc(data.app_user_id)
          .update({
            isGroupAdmin: plansAccess[data.product_id].isGroupAdmin,
            isPlanActive: plansAccess[data.product_id].isPlanActive,
            plan: data.product_id,
            joinedGroupId: data.app_user_id,
          });
      }

      //  if it is family version
      else if (
        data.product_id == "eap_999_1m_1m999" ||
        data.product_id == "eap_999_1y_1y999:eap-999-1y-1y999"
      ) {
        console.log("Product is Family Version");
        await admin
          .firestore()
          .collection("users")
          .doc(data.app_user_id)
          .update({
            isGroupAdmin: plansAccess[data.product_id].isGroupAdmin,
            isPlanActive: plansAccess[data.product_id].isPlanActive,
            plan: data.product_id,
          });

        let userData = await admin.auth().getUser(data.app_user_id);

        groupData.authorId = data.app_user_id;
        groupData.members[`${data.app_user_id}`] = {
          email: userData.email,
          name: userData.displayName,
        };

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
        "User: " +
          data.app_user_id +
          " renewel to " +
          data.product_id +
          " from " +
          data.store
      );

      return await admin
        .firestore()
        .collection("users")
        .doc(data.app_user_id)
        .update({
          isGroupAdmin: plansAccess[data.product_id].isGroupAdmin,
          isPlanActive: plansAccess[data.product_id].isPlanActive,
          plan: data.product_id,
        });
    } else if (data.type == "EXPIRATION") {
      return console.log(
        "User: " +
          data.app_user_id +
          " expiration to " +
          data.product_id +
          " from " +
          data.store
      );
    } else {
      return console.log(
        "User: " +
          data.app_user_id +
          +" " +
          data.type +
          " to " +
          data.product_id +
          " from " +
          data.store
      );
    }
  });

module.exports = SubscriptionEventWatcher;
