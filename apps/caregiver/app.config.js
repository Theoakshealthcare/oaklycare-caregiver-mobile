// Extends app.json. The Firebase client config (google-services.json) is not committed: on EAS it arrives as a
// file environment variable (GOOGLE_SERVICES_JSON); locally it is read from ./google-services.json when present.
const fs = require("node:fs");

module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync("./google-services.json") ? "./google-services.json" : undefined);
  if (!googleServicesFile) return config;
  return { ...config, android: { ...config.android, googleServicesFile } };
};
