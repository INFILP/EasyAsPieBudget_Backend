const fetch = require("node-fetch");

//   const message = {
//     to: user.notificationToken,
//     sound: "default",
//     title: "Recurring Payment",
//     body: `${user?.currencyCode}${payment.amountSpent} has been deducted from your budget`,
//     data: { someData: "", path: "home_stack" },
//   };

const sendNotificaion = async (message) => {
  return await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
};

module.exports = { sendNotificaion };
