/**
 * Telegram Bot API Routes
 */

const express = require('express');
const router = express.Router();
const telegramBotService = require('../services/telegramBotService');

// POST /api/v1/telegram/alert
router.post('/alert', async (req, res) => {
  try {
    const { requisition, eventType, chatId } = req.body;
    if (chatId) {
      telegramBotService.addSubscriber(chatId);
    }
    const result = await telegramBotService.broadcastRequisitionAlert(requisition || req.body, eventType || 'SUBMITTED');
    return res.status(200).json({
      success: true,
      botUsername: '@Track_plan_bot',
      ...result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'TELEGRAM_ALERT_ERROR',
        message: err.message
      }
    });
  }
});

// GET /api/v1/telegram/status
router.get('/status', (req, res) => {
  return res.status(200).json({
    success: true,
    botUsername: '@Track_plan_bot',
    tokenConfigured: true,
    subscribersCount: telegramBotService.getSubscribers().length,
    subscribers: telegramBotService.getSubscribers()
  });
});

// POST /api/v1/telegram/subscribe
router.post('/subscribe', (req, res) => {
  const { chatId } = req.body;
  if (!chatId) {
    return res.status(400).json({ success: false, message: 'chatId is required' });
  }
  const added = telegramBotService.addSubscriber(chatId);
  return res.status(200).json({
    success: true,
    added: added,
    subscribersCount: telegramBotService.getSubscribers().length
  });
});

module.exports = router;
