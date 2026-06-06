import { Request, Response } from "express";
import { EmailLog } from "../model/emailLog.model";
import logger from "../util/logger.util";

export async function getEmailMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const [totals, byKind, , recentSeries] = await Promise.all([
      EmailLog.aggregate([
        { $match: { sentAt: { $gte: fromDate, $lte: toDate } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          },
        },
      ]),

      EmailLog.aggregate([
        { $match: { sentAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: "$kind", total: { $sum: 1 }, sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } } } },
        { $project: { kind: "$_id", total: 1, sent: 1, failed: 1, _id: 0 } },
        { $sort: { total: -1 } },
      ]),

      EmailLog.aggregate([
        { $match: { sentAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      EmailLog.aggregate([
        { $match: { sentAt: { $gte: fromDate, $lte: toDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$sentAt" } },
            sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          },
        },
        { $project: { date: "$_id", sent: 1, failed: 1, _id: 0 } },
        { $sort: { date: 1 } },
      ]),
    ]);

    const t = totals[0] ?? { total: 0, sent: 0, failed: 0 };
    const deliveryRate = t.total > 0 ? t.sent / t.total : 1;

    res.json({
      totals: { total: t.total, sent: t.sent, failed: t.failed, deliveryRate },
      byKind,
      series: recentSeries,
    });
  } catch (err) {
    logger.error({ message: "[admin] getEmailMetrics error", error: String(err) });
    res.status(500).json({ error: "Failed to fetch email metrics" });
  }
}

export async function getEmailList(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"))));
    const skip = (page - 1) * limit;
    const { status, kind, search } = req.query as { status?: string; kind?: string; search?: string };

    const filter: Record<string, unknown> = {};
    if (status === "sent" || status === "failed") filter.status = status;
    if (kind) filter.kind = kind;
    if (search) filter.to = { $regex: search, $options: "i" };

    const [logs, total] = await Promise.all([
      EmailLog.find(filter).sort({ sentAt: -1 }).skip(skip).limit(limit).lean(),
      EmailLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit });
  } catch (err) {
    logger.error({ message: "[admin] getEmailList error", error: String(err) });
    res.status(500).json({ error: "Failed to fetch email list" });
  }
}
