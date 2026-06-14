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
  // Admins only
  if (req.user.role !== 'admin')
    return next(
      new AppError('You do not have permission to update this ticket', 403),
    );

  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  // Only allow priority and status to be updated by admin
  const allowed = ['priority', 'status'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) ticket[field] = req.body[field];
  });

  await ticket.save();

  res.status(200).json({ status: 'success', data: { ticket } });
});

exports.deleteTicket = catchAsync(async (req, res, next) => {
  // Admins only
  if (req.user.role !== 'admin')
    return next(
      new AppError('You do not have permission to delete this ticket', 403),
    );

  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  await Ticket.findByIdAndDelete(req.params.id);

  res.status(204).json({ status: 'success', data: null });
});

exports.uploadAttachment = catchAsync(async (req, res, next) => {
  // User must own the ticket or be admin
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id)
    return next(
      new AppError('You do not have permission to upload to this ticket', 403),
    );

  // If file was uploaded and processed
  if (req.file && req.file.filename) {
    ticket.attachments.push({
      filename: req.file.filename,
      uploadedAt: new Date(),
    });

    await ticket.save();

    return res.status(200).json({
      status: 'success',
      message: 'Attachment uploaded successfully',
      data: { ticket },
    });
  }

  return next(new AppError('No file uploaded', 400));
});

exports.addAdminReply = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(
      new AppError('You do not have permission to reply to this ticket', 403),
    );
  }

  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  if (!req.body.text) {
    return next(new AppError('Reply text is required', 400));
  }

  ticket.adminReplies.push({
    text: req.body.text,
    admin: req.user.id,
    repliedAt: Date.now(),
  });

  if (ticket.status === 'open') {
    ticket.status = 'in-progress';
  }

  await ticket.save();

  await ticket.populate('adminReplies.admin', 'name email photo');

  res.status(201).json({
    status: 'success',
    data: { ticket },
  });
});

exports.getAdminReplies = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id).populate(
    'adminReplies.admin',
    'name email photo',
  );

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id) {
    return next(
      new AppError(
        'You do not have permission to view replies on this ticket',
        403,
      ),
    );
  }

  res.status(200).json({
    status: 'success',
    results: ticket.adminReplies.length,
    data: { replies: ticket.adminReplies },
  });
});
