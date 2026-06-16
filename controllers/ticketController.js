const { sendEmail } = require('../utils/email');
const User = require('../models/userModel');
const Ticket = require('../models/ticketModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const {
  detectPriority,
  detectPriorityDetailed,
} = require('../utils/priorityDetector');

exports.createTicket = catchAsync(async (req, res, next) => {
  req.body.user = req.user.id;

  let detectionDetails = null;
  if (!req.body.priority) {
    const text = `${req.body.title || ''} ${req.body.description || ''}`;
    detectionDetails = detectPriorityDetailed(text);
    req.body.priority = detectionDetails.priority || 'medium';
  }

  const ticket = await Ticket.create(req.body);

  try {
    const initialEntry = {
      from: null,
      to: ticket.priority,
      reason: detectionDetails ? 'auto-detected' : 'created',
      changedBy: detectionDetails ? undefined : req.user.id,
      changedByType: detectionDetails ? 'auto' : 'user',
      at: Date.now(),
    };
    ticket.priorityHistory = ticket.priorityHistory || [];
    ticket.priorityHistory.push(initialEntry);
    await ticket.save();
  } catch (err) {
    console.warn('Failed to record priority history', err.message || err);
  }

  // Send confirmation email to user
  try {
    await sendEmail({
      to: req.user.email,
      subject: `Ticket Created: ${ticket.title}`,
      text: `Hi ${req.user.name},\n\nYour ticket has been created successfully.\n\nTitle: ${ticket.title}\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\nStatus: ${ticket.status}\n\nWe will get back to you soon.\n\nSupport Team`,
      html: `
        <h2>Ticket Created Successfully</h2>
        <p>Hi <strong>${req.user.name}</strong>,</p>
        <p>Your support ticket has been received.</p>
        <table>
          <tr><td><strong>Title:</strong></td><td>${ticket.title}</td></tr>
          <tr><td><strong>Category:</strong></td><td>${ticket.category}</td></tr>
          <tr><td><strong>Priority:</strong></td><td>${ticket.priority}</td></tr>
          <tr><td><strong>Status:</strong></td><td>${ticket.status}</td></tr>
        </table>
        <p>We will get back to you soon.</p>
        <p>Support Team</p>
      `,
    });
  } catch (err) {
    console.warn('Failed to send ticket creation email', err.message || err);
  }

  const responseBody = { ticket };
  if (detectionDetails) responseBody.priorityDetection = detectionDetails;

  res.status(201).json({ status: 'success', data: responseBody });
});

exports.reEvaluatePriority = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id)
    return next(new AppError('You do not have access to this ticket', 403));

  const text = `${ticket.title || ''} ${ticket.description || ''}`;
  const detailed = detectPriorityDetailed(text);
  const oldPriority = ticket.priority;
  const newPriority = detailed.priority || 'medium';

  ticket.priority = newPriority;
  // add history entry if priority changed
  if (oldPriority !== newPriority) {
    ticket.priorityHistory = ticket.priorityHistory || [];
    ticket.priorityHistory.push({
      from: oldPriority,
      to: newPriority,
      reason: 're-evaluated',
      changedByType: 'auto',
      at: Date.now(),
    });
  }

  await ticket.save();

  res.status(200).json({
    status: 'success',
    data: {
      ticket,
      priorityChange: { from: oldPriority, to: newPriority, details: detailed },
    },
  });
});

exports.overridePriority = catchAsync(async (req, res, next) => {
  // Admins only
  if (req.user.role !== 'admin')
    return next(
      new AppError('You do not have permission to override priority', 403),
    );

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  const { priority, reason } = req.body;
  if (!priority || !['low', 'medium', 'high'].includes(priority)) {
    return next(new AppError('Invalid or missing priority', 400));
  }

  const oldPriority = ticket.priority;
  if (oldPriority === priority) {
    return res.status(200).json({
      status: 'success',
      data: { ticket, message: 'Priority unchanged' },
    });
  }

  ticket.priority = priority;
  ticket.priorityHistory = ticket.priorityHistory || [];
  ticket.priorityHistory.push({
    from: oldPriority,
    to: priority,
    reason: reason || 'admin override',
    changedBy: req.user.id,
    changedByType: 'admin',
    at: Date.now(),
  });

  await ticket.save();

  res.status(200).json({
    status: 'success',
    data: { ticket, priorityChange: { from: oldPriority, to: priority } },
  });
});

exports.getAllTickets = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.user = req.user.id;

  const features = new APIFeatures(Ticket.find(filter), req.query)
    .filter()
    .search()
    .sort()
    .limitFields()
    .paginate();

  const tickets = await features.query;

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
  if (req.user.role !== 'admin')
    return next(
      new AppError('You do not have permission to update this ticket', 403),
    );

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return next(new AppError('No ticket found with that ID', 404));

  const allowed = ['priority', 'status'];
  let priorityChanged = false;
  let statusChanged = false;
  let oldPriority = ticket.priority;
  let oldStatus = ticket.status;

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (field === 'priority' && req.body[field] !== ticket.priority) {
        priorityChanged = true;
        oldPriority = ticket.priority;
      }
      if (field === 'status' && req.body[field] !== ticket.status) {
        statusChanged = true;
      }
      ticket[field] = req.body[field];
    }
  });

  if (priorityChanged) {
    ticket.priorityHistory = ticket.priorityHistory || [];
    ticket.priorityHistory.push({
      from: oldPriority,
      to: ticket.priority,
      reason: req.body.reason || 'admin update',
      changedBy: req.user.id,
      changedByType: 'admin',
      at: Date.now(),
    });
  }

  await ticket.save();

  // Send email to user if status changed
  if (statusChanged) {
    try {
      const ticketOwner = await User.findById(ticket.user);
      if (ticketOwner) {
        await sendEmail({
          to: ticketOwner.email,
          subject: `Ticket Status Updated: ${ticket.title}`,
          text: `Hi ${ticketOwner.name},\n\nYour ticket status has been updated.\n\nTitle: ${ticket.title}\nOld Status: ${oldStatus}\nNew Status: ${ticket.status}\n\nSupport Team`,
          html: `
            <h2>Ticket Status Updated</h2>
            <p>Hi <strong>${ticketOwner.name}</strong>,</p>
            <p>Your ticket status has changed.</p>
            <table>
              <tr><td><strong>Title:</strong></td><td>${ticket.title}</td></tr>
              <tr><td><strong>Old Status:</strong></td><td>${oldStatus}</td></tr>
              <tr><td><strong>New Status:</strong></td><td>${ticket.status}</td></tr>
            </table>
            <p>Support Team</p>
          `,
        });
      }
    } catch (err) {
      console.warn('Failed to send status update email', err.message || err);
    }
  }

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

  // Send email to ticket owner
  try {
    const ticketOwner = await User.findById(ticket.user);
    if (ticketOwner) {
      await sendEmail({
        to: ticketOwner.email,
        subject: `New Reply on Your Ticket: ${ticket.title}`,
        text: `Hi ${ticketOwner.name},\n\nAdmin has replied to your ticket.\n\nTitle: ${ticket.title}\nReply: ${req.body.text}\n\nSupport Team`,
        html: `
          <h2>New Reply on Your Ticket</h2>
          <p>Hi <strong>${ticketOwner.name}</strong>,</p>
          <p>The support team has replied to your ticket.</p>
          <table>
            <tr><td><strong>Title:</strong></td><td>${ticket.title}</td></tr>
            <tr><td><strong>Reply:</strong></td><td>${req.body.text}</td></tr>
          </table>
          <p>Support Team</p>
        `,
      });
    }
  } catch (err) {
    console.warn('Failed to send admin reply email', err.message || err);
  }

  res.status(201).json({ status: 'success', data: { ticket } });
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
