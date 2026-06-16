const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cors = require('cors');

const userRouter = require('./routes/userRoutes');
const ticketRouter = require('./routes/ticketRoutes');
const analyticsRouter = require('./routes/analyticsRoutes');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const app = express();

// Global middlewares
app.use(helmet());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour',
});
app.use('/api', limiter);

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());
app.use(cors());

// Serve static files from public folder
app.use(express.static(`${__dirname}/public`));

// Routes
app.use('/api/v1/users', userRouter);
app.use('/api/v1/tickets', ticketRouter);
app.use('/api/v1/analytics', analyticsRouter);

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
