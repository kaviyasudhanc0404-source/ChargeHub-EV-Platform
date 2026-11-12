const Report = require('../models/Report.model');
const { AppError, asyncHandler } = require('../middleware/error.middleware');

// @route   POST /api/reports   (user or provider)
exports.createReport = asyncHandler(async (req, res) => {
  const { category, subject, message, stationId } = req.body;
  const report = await Report.create({
    reporterId: req.user._id,
    reporterName: req.user.name,
    reporterRole: req.user.role,
    category,
    subject,
    message,
    stationId: stationId || null
  });
  res.status(201).json({ success: true, message: 'Report submitted. Our team will look into it.', data: report });
});

// @route   GET /api/reports?status=   (admin)
exports.getReports = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const reports = await Report.find(filter)
    .populate('reporterId', 'email')
    .populate('stationId', 'name')
    .sort({ status: 1, createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, count: reports.length, data: reports });
});

// @route   PATCH /api/reports/:id/resolve   (admin)
exports.resolveReport = asyncHandler(async (req, res) => {
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status: 'resolved', adminNote: req.body.adminNote, resolvedAt: new Date() },
    { new: true, runValidators: true }
  );
  if (!report) throw new AppError(404, 'Report not found');
  res.json({ success: true, message: 'Report marked as resolved', data: report });
});

// @route   DELETE /api/reports/:id   (admin)
exports.deleteReport = asyncHandler(async (req, res) => {
  const report = await Report.findByIdAndDelete(req.params.id);
  if (!report) throw new AppError(404, 'Report not found');
  res.json({ success: true, message: 'Report deleted' });
});
