const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");
const dotenv = require("dotenv");

dotenv.config();

// {
//   type: process.env.type,
//   project_id: process.env.project_id,
//   private_key_id: process.env.private_key_id,
//   private_key: process.env.private_key,
//   client_email: process.env.client_email,
//   client_id: process.env.client_id,
//   auth_uri: process.env.auth_uri,
//   token_uri: process.env.token_uri,
//   auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
//   client_x509_cert_url: process.env.client_x509_cert_url,
//   universe_domain: process.env.universe_domain,
// }

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://easyaspie-70cf6-default-rtdb.firebaseio.com",
});

const getNextMonthDate = (date) => {
  const currentDate = new Date(date);
  const nextMonthDate = new Date(currentDate);

  // Get the current month and year
  let currentMonth = nextMonthDate.getMonth();
  let currentYear = nextMonthDate.getFullYear();

  // Set the date to the first day of the next month
  currentMonth = (currentMonth + 1) % 12;
  if (currentMonth === 0) {
    // If the current month is December, increment the year
    currentYear++;
  }

  nextMonthDate.setMonth(currentMonth);
  nextMonthDate.setFullYear(currentYear);

  return nextMonthDate;
};

const generateMonthlyZeroBudget = async () => {
  try {
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    let pastBudgetDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1
    );
    pastBudgetDate.setHours(0, 0, 0, 0);

    let nextBugetDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 2,
      1
    );
    nextBugetDate.setHours(0, 0, 0, 0);

    // Start of the day
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);

    // End of the day
    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(
      `------------------------Running zeroBudgetMonthlyGeneratorService on ${startOfDay}------------------------`
    );

    // Getting all last month budgets
    const lastZeroBasedBudgets = await admin
      .firestore()
      .collection("budgets")
      .where("budgetType", "==", "zero_based")
      .where(
        "budget.budgetMonth",
        "==",
        (pastBudgetDate.getMonth() + 1).toString()
      )
      .where("budget.budgetYear", "==", pastBudgetDate.getFullYear().toString())
      .get();

    if (lastZeroBasedBudgets.docs.length == 0) {
      console.log("No past budgets found!");
      return;
    } else {
      console.log(`${lastZeroBasedBudgets.docs.length} new budgets to add!`);
    }

    const lastZeroBasedBudgetsData = [];
    for (let i = 0; i < lastZeroBasedBudgets.docs.length; i++) {
      const doc = lastZeroBasedBudgets.docs[i];
      const docData = doc.data();

      // if a category does not have auto adjust we need to move it to carry over so user and manually adjust is
      let categoriesTotalCarryOverWithNoAuthAdjust = 0;
      Object.values(docData.categories)
        .filter((category) => !category?.autoAdjust)
        .map((category) =>
          category?.amountLeft ? parseFloat(category.amountLeft) : 0
        )
        .forEach(
          (category) => (categoriesTotalCarryOverWithNoAuthAdjust += category)
        );

      // console.log(categoriesTotalCarryOverWithNoAuthAdjust);

      let categories = {};

      Object.values(docData.categories).forEach((category) => {
        const carryOver = category?.carryOverAmountLeft
          ? (
              parseFloat(category?.carryOverAmountLeft) +
              parseFloat(category.amountLeft)
            ).toString()
          : category.amountLeft?.toString();

        if (category?.autoAdjust) {
          categories[category.id] = {
            ...category,
            amountSpent: "0",
            amountLeft: category.budgetToSpend.toString(),
            carryOverBudgetToSpend: carryOver,
            carryOverAmountLeft: carryOver,
            carryOverAmountSpent: "0",
            createdAt: new Date().toISOString(),
          };
        } else {
          categories[category.id] = {
            ...category,
            amountSpent: "0",
            amountLeft: category.budgetToSpend.toString(),
            carryOverBudgetToSpend: "0",
            carryOverAmountLeft: "0",
            carryOverAmountSpent: "0",
            createdAt: new Date().toISOString(),
          };
        }
      });

      //   console.dir(categories);

      lastZeroBasedBudgetsData.push({
        ...docData,
        id: `${docData.ownerId}_${
          nextBugetDate.getMonth() + 1
        }_${nextBugetDate.getFullYear()}_${docData.budgetMode}_${
          docData.budgetType
        }`,
        budget: {
          ...docData.budget,
          budgetMonth: (nextBugetDate.getMonth() + 1).toString(),
          spendingDuration: "month",
          budgetYear: nextBugetDate.getFullYear().toString(),
          carryOver: (
            categoriesTotalCarryOverWithNoAuthAdjust +
            parseFloat(docData.budget.totalLeft)
          ).toString(),
          budgetEndDate: nextBugetDate,
          budgetStartDate: nextBugetDate,
        },
        categories: categories,
        createdAt: new Date().toISOString(),
      });
    }

    console.dir(lastZeroBasedBudgetsData);

    const newBudgetPromises = lastZeroBasedBudgetsData.map(async (budget) => {
      console.log(`Adding budget: ${budget.id}`);
      return await admin
        .firestore()
        .collection("budgets")
        .doc(budget.id)
        .set(budget);
    });
    await Promise.all(newBudgetPromises);

    console.log(
      `-----------------------zeroBudgetMonthlyGeneratorService  Ending------------------------`
    );
    return lastZeroBasedBudgetsData;
  } catch (ex) {
    console.log("Error:", ex.message);
  }
};

const recurringPaymentsService = async (context) => {
  try {
    const isItFirstOfMonth = new Date().getDate() === 1;
    // 2023, 12, 1
    let monthlyBudgets = [];

    if (isItFirstOfMonth) {
      // Generate all zero budgets for current month
      monthlyBudgets = await generateMonthlyZeroBudget();
    }

    // Recurring payments will be done in both case but if its
    // 1st must add budgets before

    const paymentDeductionDate = new Date();
    // 2023, 12, 1
    // paymentDeductionDate = new Date(
    //   paymentDeductionDate.setDate(paymentDeductionDate.getDate() + 30)
    // );

    // Start of the day
    const startOfDay = new Date(paymentDeductionDate);
    startOfDay.setHours(0, 0, 0, 0);

    // End of the day
    const endOfDay = new Date(paymentDeductionDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(
      `------------------------Running recurringPaymentsService on ${startOfDay}------------------------`
    );

    const recurringPaymentQuerySnapshot = await admin
      .firestore()
      .collection("recurringPayments")
      .where("deductionDate", ">=", startOfDay)
      .where("deductionDate", "<=", endOfDay)
      .get();

    if (recurringPaymentQuerySnapshot.docs.length == 0) {
      console.log("No recurring payments to perform!");
      return;
    } else {
      console.log(
        `${recurringPaymentQuerySnapshot.docs.length} recurring payments to perform!`
      );
    }

    const recurringPaymentData = [];
    for (let i = 0; i < recurringPaymentQuerySnapshot.docs.length; i++) {
      const doc = recurringPaymentQuerySnapshot.docs[i];
      const docData = doc.data();
      const date = new Date(docData.deductionDate.toDate());
      recurringPaymentData.push({
        id: doc.id,
        ...docData,
        budgetId: `${docData.uid}_${
          date.getMonth() + 1
        }_${date.getFullYear()}_${docData.budgetMode}_${docData.budgetType}`,
      });
    }

    // Fetch budget data for the recurring payments using the budgetIds
    const budgetsToFetchPromises = [];

    // If its not first of month then we do not need the budgets to fetch
    // as we have them above
    if (monthlyBudgets.length == 0)
      for (let i = 0; i < recurringPaymentData.length; i++) {
        const payment = recurringPaymentData[i];

        console.log("Fetcing Budget: ", payment.budgetId);
        budgetsToFetchPromises.push(
          await admin
            .firestore()
            .collection("budgets")
            .doc(`${payment.budgetId}`)
            .get()
        );
      }

    // If its 1st of month then there will be data in monthlyBudgets array
    const budgetsToFetchResponse =
      monthlyBudgets.length > 0
        ? monthlyBudgets
        : await Promise.all(budgetsToFetchPromises);

    const spendingsToAdd = [];
    const budgetsToUpdate = {};
    const recurringPaymentToUpdate = [];

    // Convert array to json for easy keeping track of budgets to update at once
    for (let i = 0; i < budgetsToFetchResponse.length; i++) {
      const doc = budgetsToFetchResponse[i];
      if (!isItFirstOfMonth) budgetsToUpdate[doc.id] = doc.data();
      else budgetsToUpdate[doc.id] = doc;
    }

    for (let i = 0; i < recurringPaymentData.length; i++) {
      const paymentDoc = recurringPaymentData[i];
      let budgetDoc = budgetsToUpdate[paymentDoc.budgetId];

      let categoryToUpdate = Object.values(budgetDoc.categories).find(
        (category) => category.name == paymentDoc.category
      );

      if (parseFloat(categoryToUpdate.amountLeft) > 0) {
        categoryToUpdate.amountLeft = (
          parseFloat(categoryToUpdate.amountLeft) -
          parseFloat(paymentDoc.deductionAmount)
        ).toString();
        categoryToUpdate.amountSpent = (
          parseFloat(categoryToUpdate.amountSpent) +
          parseFloat(paymentDoc.deductionAmount)
        ).toString();
      }
      budgetDoc.categories[categoryToUpdate.id] = categoryToUpdate;

      const spending = {
        id: uuidv4(),
        budget: { ...budgetDoc.budget },
        category: categoryToUpdate,
        date: new Date(paymentDoc.deductionDate.toDate()),
        time: new Date(paymentDoc.deductionTime.toDate()),
        description: "",
        type: paymentDoc.type,
        amountSpent: paymentDoc.deductionAmount.toString(),
        uid: paymentDoc.uid,
        createdAt: new Date().toISOString(),
        budgetId: budgetDoc.id,
      };

      const newRecurringPayment = {
        ...paymentDoc,
        lastSpendingId: spending.id,
        lastSpendingDate: new Date(paymentDoc.deductionDate.toDate()),
        lastSpendingTime: new Date(paymentDoc.deductionTime.toDate()),
        deductionDate: getNextMonthDate(new Date(spending.date)),
        deductionTime: getNextMonthDate(new Date(spending.time)),
      };

      budgetsToUpdate[paymentDoc.budgetId] = budgetDoc;

      spendingsToAdd.push(spending);
      recurringPaymentToUpdate.push(newRecurringPayment);
    }

    console.log("Updaing recurringPayments");
    const recurringPaymentToUpdatePromiese = recurringPaymentToUpdate.map(
      async (payment) =>
        await admin
          .firestore()
          .collection("recurringPayments")
          .doc(payment.id)
          .update(payment)
    );
    await Promise.all(recurringPaymentToUpdatePromiese);

    console.log("Adding Spendings");
    const spendingsToAddPromiese = spendingsToAdd.map(
      async (payment) =>
        await admin
          .firestore()
          .collection("spendings")
          .doc(payment.id)
          .create(payment)
    );
    await Promise.all(spendingsToAddPromiese);

    if (Object.keys(budgetsToUpdate).length > 0) {
      console.log("Updaing Budgets");
      const budgetsToUpdatePromises = Object.keys(budgetsToUpdate).map(
        async (key, index) => {
          const data = budgetsToUpdate[key];

          return await admin
            .firestore()
            .collection("budgets")
            .doc(key)
            .update(data);
        }
      );
      await Promise.all(budgetsToUpdatePromises);

      const usersToSendNotifications = Object.values(budgetsToUpdate).map(
        (budget) => budget.ownerId
      );

      console.log("Gettings Users Data To Notifcations");
      const userPromises = usersToSendNotifications.map(
        async (userId) =>
          await admin.firestore().collection("users").doc(userId).get()
      );
      const usersFetchResponse = await Promise.all(userPromises);

      const usersToSendNotification = usersFetchResponse.map((doc) => {
        return { id: doc.id, ...doc.data() };
      });

      console.log("Sending Users Notifcations");
      const sendingUsersNotificaionsPromiese = usersToSendNotification.map(
        async (user) => {
          const payment = spendingsToAdd.find(
            (spending) => (spending.uid = user.id)
          );

          const message = {
            to: user.notificationToken,
            sound: "default",
            title: "Recurring Payment",
            body: `${user?.currencyCode}${payment.amountSpent} has been deducted from your budget`,
            data: { someData: "", path: "home_stack" },
          };

          return await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
          });
        }
      );
      await Promise.all(sendingUsersNotificaionsPromiese);
      console.log("Notifcations Sent to Users");
    }

    console.log(
      `-----------------------Recurring Payments Service Ending------------------------`
    );
    return null;
  } catch (ex) {
    console.log("Error:", ex.message);
    await admin.firestore().collection("serviceErrors").add({
      message: ex.message,
      service: "recurringPaymentsAndZeroBasedService",
      code: ex?.code,
      createdAt: new Date().toISOString(),
    });
  }
};

recurringPaymentsService();
