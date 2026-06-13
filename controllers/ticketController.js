const Ticket = require('../models/ticketModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.createTicket = catchAsync(async (req, res, next) => {
  // Attach current user as owner
  req.body.user = req.user.id;

  const ticket = await Ticket.create(req.body);

  res.status(201).json({ status: 'success', data: { ticket } });
});

exports.getAllTickets = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.user = req.user.id;

  const tickets = await Ticket.find(filter).sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: { tickets },
  });
});

exports.getTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id)
    return next(new AppError('You do not have access to this ticket', 403));

  res.status(200).json({ status: 'success', data: { ticket } });
});

exports.updateTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id)
    return next(new AppError('You do not have permission to update this ticket', 403));

  // Only allow certain fields to be updated
  const allowed = ['title', 'description', 'category', 'priority', 'status'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) ticket[field] = req.body[field];
  });

  await ticket.save();

  res.status(200).json({ status: 'success', data: { ticket } });
});

exports.deleteTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id)
    return next(new AppError('You do not have permission to delete this ticket', 403));

  await Ticket.findByIdAndDelete(req.params.id);

  res.status(204).json({ status: 'success', data: null });
});
