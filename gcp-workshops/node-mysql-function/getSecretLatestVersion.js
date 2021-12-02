"use strict";
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

const client = new SecretManagerServiceClient();

async function getSecretLatestVersion(secretName) {
  const [version] = await client.accessSecretVersion({
    name: `${secretName}/versions/latest`,
  });

  const payload = version.payload.data.toString();
  return payload;
}

module.exports = getSecretLatestVersion;
