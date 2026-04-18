const admin = require("firebase-admin");

let serviceAccount;

if (process.env.GCP_JSON_KEY) {
  // On Render: Parse the JSON string from the environment variable
  serviceAccount = JSON.parse(process.env.GCP_JSON_KEY);
} else {
  // On your Local PC: Use the file (make sure the path is correct)
  serviceAccount = require("../../service-account.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const messaging = admin.messaging();

module.exports = { messaging };