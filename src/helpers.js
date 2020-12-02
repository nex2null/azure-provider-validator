// Imports
const msRestNodeAuth = require('@azure/ms-rest-nodeauth');

// Exports
module.exports = { readAndValidateJsonFile, handleProvider, authenticateToAzure }

//
// Authenticates with azure and returns credentials
//
async function authenticateToAzure(program) {

  try {

    if (program.useCliCreds) {
      return await msRestNodeAuth.AzureCliCredentials.create();
    }
    else {

      // Grab authentication information
      const tenantId = program.tenantId || process.env["AZURE_TENANT_ID"];
      const clientId = program.clientId || process.env["AZURE_CLIENT_ID"];
      const secret = program.clientSecret || process.env["AZURE_CLIENT_SECRET"];

      // Login using service principal
      var authResponse = await msRestNodeAuth.loginWithServicePrincipalSecretWithAuthResponse(clientId, secret, tenantId);
      return authResponse.credentials;
    }
  }
  catch (e) {
    console.log(`The following error occurred authenticating with Azure: ${e.message}`);
    process.exit(1);
  }
}

//
// Reads and validates the json file
//
function readAndValidateJsonFile(filepath) {

  // Read the file
  const fs = require('fs')
  const fileContents = fs.readFileSync(filepath, 'utf8')

  // Parse the file contents
  try {
    var data = JSON.parse(fileContents)
  } catch (e) {
    console.log(`An error occurred parsing the json file: ${e.message}`);
    process.exit(1);
  }

  // Check that we have subscriptions
  if (!data || !data.subscriptions || data.subscriptions.length == 0) {
    console.log(`At least one subscription must exist in the json file`);
    process.exit(1);
  }

  // Validate each subscription
  for (const subscription of data.subscriptions) {

    // The subscription must have an id
    if (!subscription.subscriptionId) {
      console.log(`Each subscription in the json file must contain a subscriptionId property`);
      process.exit(1);
    }

    // The subscription must have providers
    if (!subscription.providers) {
      console.log(`Each subscription in the json file must contain a providers property`);
      process.exit(1);
    }
  }

  return data;
}

//
// Handles either registering or unregistering a provider
//
async function handleProvider(provider, shouldBeRegistered, resourceManagementClient, applyChanges) {

  // Sanity check
  if (!provider) return;

  // If the provider is not registered and it should be, then register it
  if (provider.registrationState.toUpperCase() == 'NOTREGISTERED' && shouldBeRegistered) {

    // If we are not applying changes then just report
    if (!applyChanges) {
      console.log(`${provider.namespace} is not registered, but it should be registered.`);
      return;
    }

    // Register the provider
    try {
      console.log(`Registering ${provider.namespace}...`);
      await resourceManagementClient.providers.register(provider.namespace);
    }
    catch (e) {
      console.log(`An error occurred registering the provider: ${e.message}`);
    }
  }

  // If the provider is registered and it should not be, then unregister it
  else if (provider && provider.registrationState.toUpperCase() == 'REGISTERED' && !shouldBeRegistered) {

    // If we are not applying changes then just report
    if (!applyChanges) {
      console.log(`${provider.namespace} is registered, but it should not be registered.`);
      return;
    }

    // Unregister the provider
    try {
      console.log(`Unregistering ${provider.namespace}...`);
      await resourceManagementClient.providers.unregister(provider.namespace);
    }
    catch (e) {
      console.log(`An error occurred unregistering the provider: ${e.message}`);
    }
  }

  // If the provider is registering then log that
  else if (provider && provider.registrationState.toUpperCase() == 'REGISTERING') {
    console.log(`${provider.namespace} is being registered...`);
  }

  // If the provider is unregistering then log that
  else if (provider && provider.registrationState.toUpperCase() == 'UNREGISTERING') {
    console.log(`${provider.namespace} is being unregistered...`);
  }
}