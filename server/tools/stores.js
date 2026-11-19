import { listStoreTargets, runStoreTests } from '../stores.js';

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'list_store_targets',
      description:
        'List the stores and marketplaces this agent can test a workspace against: Chrome Web Store, Microsoft Edge Add-ons, Mozilla Add-ons, Opera Add-ons, Google Play Store, Apple App Store, VS Code Marketplace and Hugging Face Spaces.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'test_store_readiness',
      description:
        'Run local readiness tests on the workspace for store submission and report exactly what is missing: manifest fields, icons, target SDK, privacy policy, privacy manifest, signing, listing screenshots. Runs on this machine, no store API and no key. Pass targets to test only some stores.',
      parameters: {
        type: 'object',
        properties: {
          targets: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Store ids: chrome, edge, firefox, opera, play, apple, vscode, huggingface. Omit to test every store.',
          },
        },
      },
    },
  },
];

export const handlers = {
  async list_store_targets() {
    return { targets: listStoreTargets() };
  },
  async test_store_readiness(args, ctx) {
    return runStoreTests(ctx.sessionId, args.targets, { compact: true });
  },
};
