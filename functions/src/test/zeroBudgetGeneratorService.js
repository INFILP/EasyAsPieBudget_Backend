const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://easyaspie-70cf6-default-rtdb.firebaseio.com",
});

const zeroBudgetGeneratorService = async (data, context) => {
  try {
    console.log(`Generate zero budget started!`);

    const { type, duration } = data;
    const currentDate = new Date();
    const endDate = new Date();
    const targetDate = new Date();
    currentDate.setDate(1);
    endDate.setDate(1);
    targetDate.setDate(1);

    targetDate.setMonth(targetDate.getMonth() - duration);
    endDate.setMonth(endDate.getMonth() + 1);

    const zeroBasedId = `${type == "personal" ? data.uid : data.groupId}_${
      currentDate.getMonth() + 1
    }_${currentDate.getFullYear()}_${type}_zero_based`;

    console.log(zeroBasedId);

    let zeroBudgetData = {
      budgetMode: type,
      budgetType: "zero_based",
      budget: {
        budgetToSpend: "0",
        totalLeft: "0",
        budgetStartDate: currentDate,
        budgetEndDate: endDate,
        spendingDuration: "month",
        budgetMonth: currentDate.getMonth() + 1,
        budgetYear: currentDate.getFullYear(),
        carryOver: "0",
      },
      categories: {},
      members: [],
    };

    if (type == "personal") {
      zeroBudgetData.ownerId = data.uid;
      zeroBudgetData.type = type;
    } else {
      zeroBudgetData.ownerId = data.groupId;
      zeroBudgetData.type = type;
    }

    let bugdetIds = [];

    for (let i = duration; i > 0; i--) {
      bugdetIds.push(
        //! OLD ID
        // `${type == "personal" ? data.uid : data.groupId}_${
        //   currentDate.getMonth() + 2 - i
        // }_${currentDate.getFullYear()}_${type}_traditional`
        `${type == "personal" ? data.uid : data.groupId}_${type}_traditional`
      );
    }

    console.log(bugdetIds);

    let docSnap = await admin
      .firestore()
      .collection("spendings")
      .where("budgetId", "in", bugdetIds)
      // .where("date", ">=", targetDate)
      // .where("date", "<=", currentDate)
      .get();

    if (docSnap.docs.length == 0) console.log("There are no spendings before");
    else console.log(docSnap.docs.length + " spendings found!");

    const user =
      type == "personal"
        ? await admin.firestore().collection("users").doc(data.uid).get()
        : await admin.firestore().collection("users").doc(data.groupId).get();

    let budgetToSpend = 0;
    let categories = {};

    Object.keys(user.data().categories).forEach((key) => {
      categories[key] = {
        id: key,
        name: user.data().categories[key],
        amountSpent: "0",
        amountLeft: "0",
        len: "0",
        color: generateRandomHexColor(),
        createdAt: new Date().toISOString(),
        carryOverBudgetToSpend: "0",
        carryOverAmountLeft: "0",
        carryOverAmountSpent: "0",
      };
    });

    docSnap.forEach((doc) => {
      const data = doc.data();

      let cateId = "";
      Object.keys(categories).forEach((key) => {
        if (categories[key].name == data.category) {
          cateId = key;
        }
      });

      if (cateId)
        categories[cateId] = {
          ...categories[cateId],
          amountLeft: parseFloat(
            categories[cateId].amountLeft + data.amountSpent
          ).toFixed(),
          len: categories[cateId].len + 1,
        };
    });

    Object.keys(categories).forEach((key) => {
      if (categories[key].len) {
        const amountLeft = parseFloat(
          categories[key].amountLeft / categories[key].len
        )
          .toFixed(2)
          .toString();
        categories[key] = {
          name: categories[key].name,
          amountSpent: parseFloat(categories[key].amountSpent).toFixed(2),
          amountLeft: amountLeft,
        };
        budgetToSpend += amountLeft;
      } else {
        categories[key] = {
          name: categories[key].name,
          amountSpent: parseFloat(categories[key].amountSpent).toFixed(2),
          amountLeft: 0,
        };
      }
    });

    zeroBudgetData.categories = categories;
    zeroBudgetData.budget.budgetToSpend = parseFloat(budgetToSpend).toFixed(2);
    zeroBudgetData.budget.totalLeft = parseFloat(budgetToSpend).toFixed(2);

    // Add members in the budget
    if (type == "personal") zeroBudgetData.members.push(data.uid);
    else {
      const groupDocRef = await admin
        .firestore()
        .collection("familyGroups")
        .doc(data.groupId)
        .get();

      const groupData = groupDocRef.data();
      const groupMembers = groupData.members;
      const groupMembeKeys = Object.keys(groupMembers);
      zeroBudgetData.members = groupMembeKeys;
    }

    console.log(zeroBudgetData);

    await admin
      .firestore()
      .collection("budgets")
      .doc(zeroBasedId)
      .create(zeroBudgetData);

    zeroBudgetData.budget.budgetEndDate =
      zeroBudgetData.budget.budgetEndDate.toISOString();
    zeroBudgetData.budget.budgetStartDate =
      zeroBudgetData.budget.budgetStartDate.toISOString();

    return {
      data: zeroBudgetData,
      error: null,
      message: "Budget Created!",
    };
  } catch (ex) {
    console.log(ex.message);
    return { error: true, message: ex.message, data: null };
  }
};

// const payload = {
//   duration: 3,
//   uid: "wJ9USfwaphNsmejhiGYvhNEHug73",
//   type: "personal",
// };

const payload = {
  duration: 1,
  groupId: "wJ9USfwaphNsmejhiGYvhNEHug73",
  type: "group",
};

zeroBudgetGeneratorService(payload);
