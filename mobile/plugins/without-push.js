// Reminders are local notifications, which need no entitlement. expo-notifications
// still adds aps-environment (remote push), and a free Apple ID can't sign that.
// ponytail: delete this plugin (and its app.json entry) if the app ever sends push.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults["aps-environment"];
    return c;
  });
