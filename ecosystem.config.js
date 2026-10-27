module.exports = {
  apps: [
    {
      name: 'tdpcs-apt',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 5000',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      time: true,
    },
  ],
};
