const admin = require("firebase-admin");
const AddFamilyMember = require("./src/addFamilyMember");
const AcceptFamilyMemberRequest = require("./src/sendRequestAcceptNotification");
const SubscriptionEventWatcher = require("./src/subscriptionEventWatcher");
const recurringPaymentsService = require("./src/recurringPaymentsService");
const purgeUser = require("./src/purgeUser");
const zeroBudgetGeneratorService = require("./src/zeroBudgetGeneratorService");
const removeBatchRecurringPayments = require("./src/removeBatchRecurringPayments");

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
