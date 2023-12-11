const functions = require("firebase-functions");
const admin = require("firebase-admin");

const removeBatchRecurringPayments = functions.https.onCall(
  async (data, context) => {
    try {
      const { uid } = data;
      functions.logger.log(`User: ${uid} recuring payment deletion started!`);

      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .get();

      const userData = userDoc.data();

      if (!userData.plan.active) {
        // Delete All User Data
        const recurringPaymentsDocs = await admin
          .firestore()
          .collection("recurringPayments")
          .where("uid", "==", uid)
          .get();

        if (recurringPaymentsDocs.docs.length > 0) {
          let recurringPaymentsDocsData = [];

          for (let i = 0; i < recurringPaymentsDocs.docs.length; i++) {
            const doc = recurringPaymentsDocs.docs[i];
            const docData = doc.data();
            const docId = doc.id;

            recurringPaymentsDocsData.push({
              id: docId,
              ...docData,
            });
          }

          const deletePromises = recurringPaymentsDocsData.map(
            async (payment) =>
              await admin
                .firestore()
                .collection("recurringPayments")
                .doc(`${payment.id}`)
                .delete()
          );

          await Promise.all(deletePromises);
        }
      }

      return `User: ${uid} recuring payment deletion completed!`;
    } catch (ex) {
      functions.logger.log(ex.message);
      await admin.firestore().collection("serviceErrors").add({
        message: ex.message,
        service: "removeBatchRecurringPayments",
        code: ex?.code,
        createdAt: new Date().toISOString(),
      });
    }
  }
);

module.exports = removeBatchRecurringPayments;
