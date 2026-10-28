const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { sequelize } = require('./models');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Root health check endpoint - reports server status and db connectivity
app.get('/health', async (req, res) => {
  let dbStatus = 'down';
  try {
    await sequelize.authenticate();
    dbStatus = 'up';
  } catch (err) {
    dbStatus = 'down';
  }

  res.status(200).json({
    status: 'ok',
    db: dbStatus
  });
});

// API Routes
app.use('/api', apiRoutes);

// 404 handler
app.use(notFound);

// Central error handler
app.use(errorHandler);

module.exports = app;
