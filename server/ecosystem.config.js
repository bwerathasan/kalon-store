module.exports = {
  apps: [
    {
      name: 'kalon',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
    },
  ],
};
