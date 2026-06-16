const Ticket = require('../models/ticketModel');
const catchAsync = require('../utils/catchAsync');

exports.getAdminAnalytics = catchAsync(async (req, res, next) => {
  const [
    byStatus,
    byPriority,
    byCategory,
    totalTickets,
    attachmentStats,
    resolutionTime,
  ] = await Promise.all([
    Ticket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Ticket.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Ticket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Ticket.countDocuments(),

    Ticket.aggregate([
      {
        $group: {
          _id: null,
          withAttachments: {
            $sum: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$attachments', []] } }, 0] },
                1,
                0,
              ],
            },
          },
          withoutAttachments: {
            $sum: {
              $cond: [
                { $eq: [{ $size: { $ifNull: ['$attachments', []] } }, 0] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    Ticket.aggregate([
      { $match: { status: { $in: ['resolved', 'closed'] } } },
      {
        $group: {
          _id: null,
          avgResolutionTimeMs: {
            $avg: { $subtract: ['$updatedAt', '$createdAt'] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          avgResolutionTimeHours: {
            $round: [{ $divide: ['$avgResolutionTimeMs', 3600000] }, 2],
          },
        },
      },
    ]),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      totalTickets,
      byStatus,
      byPriority,
      byCategory,
      attachmentStats: attachmentStats[0] || {
        withAttachments: 0,
        withoutAttachments: 0,
      },
      avgResolutionTimeHours: resolutionTime[0]?.avgResolutionTimeHours || 0,
    },
  });
});
