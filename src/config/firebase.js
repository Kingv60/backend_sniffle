const admin = require("firebase-admin");

// Hum 'src/config' mein hain, isliye root tak jaane ke liye ../../ chahiye
const serviceAccount = require("../../service-account.json"); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const messaging = admin.messaging();

module.exports = { messaging };