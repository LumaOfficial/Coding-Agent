import { detectPlatform } from '../platform.js';

export const definitions = [
  {
    type: 'function',
    function: {
      name: 'detect_platform',
      description:
        'Detect the coding platform this agent runs on: OS and distro, container runtime, Node version, shell, editor/terminal, CI system, git repo and branch, and which dev tools (git, npm, pnpm, python, go, docker, gh…) are installed. Call it before giving environment-specific setup steps or shell commands. Runs locally, no external API.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export const handlers = {
  async detect_platform() {
    return detectPlatform();
  },
};
