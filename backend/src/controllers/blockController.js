/**
 * Block Optimization Controller
 */

const trainDataService = require('../services/trainDataService');
const blockOptimizationService = require('../services/blockOptimizationService');
const auditLogService = require('../services/auditLogService');
const telegramBotService = require('../services/telegramBotService');

class BlockController {
  async evaluate(req, res, next) {
    try {
      const payload = req.validatedBlockRequest;

      // 1. Fetch corridor trains (RailRadar live or timetable fallback)
      const corridorData = await trainDataService.getCorridorTrains(
        payload.fromStation,
        payload.toStation,
        payload.worksiteKmRange,
        payload.trackLine,
        payload.worksiteStartKm,
        payload.worksiteEndKm
      );

      // 2. Compute optimal continuous block recommendation
      const result = blockOptimizationService.findOptimalBlock(corridorData, payload);

      // 3. Log decision in audit history and block decisions table
      auditLogService.logAction(
        'EVALUATE_BLOCK',
        payload.submittedBy || 'RailFlow Optimizer',
        `Evaluated block request for ${payload.fromStation}-${payload.toStation} (${payload.trackLine}, ${payload.worksiteKmRange}): ${result.status}`
      );

      const db = require('../services/db');
      await db.logBlockDecision({
        reqId: payload.reqId || payload.id || null,
        department: payload.department || null,
        corridor: `${payload.fromStation} - ${payload.toStation}`,
        requestedWindow: payload.preferredSlot || null,
        durationMin: payload.durationMin || null,
        selectedWindow: result.recommendedBlock || null,
        conflictsConsidered: result.conflictsSummary || result.summary || null,
        status: result.status || 'EVALUATED',
        dataSource: corridorData.dataSource || 'RailFlow Engine'
      });

      // 4. Trigger Telegram Bot Alert Broadcast with AI recommended slot
      telegramBotService.broadcastRequisitionAlert({
        reqId: payload.reqId || result.requestId || 'REQ-SR-PLAN',
        department: payload.department || 'Department Requisition',
        sectionName: `${payload.fromStation} – ${payload.toStation}`,
        fromStation: payload.fromStation,
        toStation: payload.toStation,
        trackLine: payload.trackLine,
        blockType: payload.blockType,
        worksiteStartKm: payload.worksiteStartKm,
        worksiteEndKm: payload.worksiteEndKm,
        kmRange: payload.worksiteKmRange,
        workType: payload.workDesc || payload.workCategory || 'Maintenance Block',
        durationMin: payload.durationMin || 150,
        urgency: payload.urgency || 'Due',
        sanctionedSlot: result.recommendedBlock,
        recommendedBlock: result.recommendedBlock,
        status: result.status || 'SCHEDULED'
      }, 'SUBMITTED').catch(err => console.warn('[TelegramBot] Async alert error:', err.message));

      return res.status(200).json({
        success: true,
        result: result,
        corridorData: {
          fromStation: corridorData.fromStation,
          toStation: corridorData.toStation,
          fromKm: corridorData.fromKm,
          toKm: corridorData.toKm,
          sectionKmRange: corridorData.sectionKmRange,
          worksiteStartKm: corridorData.worksiteStartKm,
          worksiteEndKm: corridorData.worksiteEndKm,
          kmValidation: corridorData.kmValidation,
          liveDataAvailable: corridorData.liveDataAvailable,
          liveStatusText: corridorData.liveStatusText,
          timetableStatusText: corridorData.timetableStatusText,
          dataSource: corridorData.dataSource,
          liveUnavailableReason: corridorData.liveUnavailableReason,
          trainsCount: corridorData.trains.length,
          trains: corridorData.trains
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BlockController();
