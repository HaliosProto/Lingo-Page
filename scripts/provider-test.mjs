import process from 'node:process';
import {
  providerIds,
  testProviderConnection,
  toProviderTestCliOutput,
} from './provider-test-lib.mjs';

const argumentsAfterSeparator = process.argv.slice(2).filter((value) => value !== '--');
const providerId = argumentsAfterSeparator[0];
if (!providerId || !providerIds.has(providerId)) {
  console.error('Usage: pnpm provider:test -- <provider-id>');
  process.exitCode = 2;
} else {
  const result = await testProviderConnection(providerId);
  if (result.status === 'ok') {
    console.log(JSON.stringify(toProviderTestCliOutput(result)));
  } else {
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  }
}
