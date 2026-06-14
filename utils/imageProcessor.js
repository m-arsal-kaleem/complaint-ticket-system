const sharp = require('sharp');
const catchAsync = require('./catchAsync');

exports.processTicketAttachment = catchAsync(async (req, res, next) => {
  // If no file uploaded, skip
  if (!req.file) return next();

  // Generate filename: ticket-attachment-{timestamp}.jpeg
  const filename = `ticket-attachment-${Date.now()}.jpeg`;
  req.file.filename = filename;

  // Process and save image to public/img/attachments folder
  await sharp(req.file.buffer)
    .resize(800, 600, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toFile(`public/img/attachments/${filename}`);

  next();
});
