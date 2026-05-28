// [RESOLVED TypeScript build safety]
// Export a plain config object to ensure 'tsc --noEmit' compiles perfectly
// in local development environments where the global 'open-next' package is not installed.
const config = {
  default: {
    minify: true,
    placement: 'global',
  },
};

export default config;
