#!/usr/bin/env node

// Imports
const commander = require('commander');
const helpers = require('./helpers');
const armResources = require('@azure/arm-resources');

// Create the Commander program
const program = new commander.Command();
program.version('1.0.0');

// Setup options
program.requiredOption('-f, --file <path>', 'Path of the json file containing registration information.');
program.option('--apply-changes', 'Whether changes should be applied. If this is not set, changes will just be reported.', false);
program.option('--tenant-id <id>', 'The Azure AD tenant id to use for authentication. If not supplied the value will be read from the AZURE_TENANT_ID variable.');
program.option('--client-id <id>', 'The Azure AD client id (application id) to use for authentication. If not supplied the value will be read from the AZURE_CLIENT_ID environment variable.');
program.option('--client-secret <secret>', 'The Azure AD client secret used for authentication. If not supplied the value will be read from the AZURE_CLIENT_SECRET environment variable.');
program.option('--use-cli-creds', 'Use the credentials pulled from the Azure CLI instead of providing Service Principal credentials.')

// Parse command line options
program.parse(process.argv);

// Main function
async function main() {

  // Get azure credentials
  var credentials = await helpers.authenticateToAzure(program);

  // Grab our resource providers data
  var providerData = helpers.readAndValidateJsonFile(program.file);

  // Loop through each subscription
  for (const subscription of providerData.subscriptions) {

    // Log that we are processing
    console.log(`Processing subscription ${subscription.subscriptionName} (${subscription.subscriptionId})...`);

    // Grab all the providers from azure for the subscription
    var resourceManagementClient = new armResources.ResourceManagementClient(credentials, subscription.subscriptionId);
    var azureProviders = await resourceManagementClient.providers.list();

    // Loop through each provider in the subscription
    var providerNamespaces = Object.keys(subscription.providers);
    for (const providerNamespace of providerNamespaces) {

      // Grab if the provider should be registered
      var shouldBeRegistered = subscription.providers[providerNamespace];

      // Find the azure provider
      var azureProvider = azureProviders.filter(x => x.namespace.toUpperCase() == providerNamespace.toUpperCase()).pop();
      if (!azureProvider) {
        console.log(`Could not find provider with namespace: ${providerNamespace}`);
        continue;
      }

      // Process the provider
      await helpers.handleProvider(azureProvider, shouldBeRegistered, resourceManagementClient, program.applyChanges);
    }
  }
}

// Call main
main()
  .catch(e => {
    console.error(e);
  });