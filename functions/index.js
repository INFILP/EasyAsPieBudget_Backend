const admin = require("firebase-admin");
const AddFamilyMember = require("./src/services/addFamilyMember");
const AcceptFamilyMemberRequest = require("./src/services/sendRequestAcceptNotification");
const SubscriptionEventWatcher = require("./src/services/subscriptionEventWatcher");
const recurringPaymentsService = require("./src/services/recurringPaymentsService");
const purgeUser = require("./src/services/purgeUser");
const zeroBudgetGeneratorService = require("./src/services/zeroBudgetGeneratorService");
const removeBatchRecurringPayments = require("./src/services/removeBatchRecurringPayments");

//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

admin.initializeApp();
exports.AddFamilyMember = AddFamilyMember;
exports.AcceptFamilyMemberRequest = AcceptFamilyMemberRequest;
exports.SubscriptionEventWatcher = SubscriptionEventWatcher;
exports.purgeUser = purgeUser;
exports.recurringPaymentsAndZeroBasedService = recurringPaymentsService;
exports.zeroBudgetGeneratorService = zeroBudgetGeneratorService;
exports.removeBatchRecurringPayments = removeBatchRecurringPayments;
