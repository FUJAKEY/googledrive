const app = require('./app');
const { initDb } = require('./services/database');

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Aurora Drive готов к работе на порту ${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Не удалось инициализировать базу данных', error);
    process.exit(1);
  });
