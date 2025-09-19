const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  const message = `🚀 SecureDrive запущен на порту ${PORT}`;
  logger.logSystem(message);
  console.log(message);
});
