import { Router } from 'express';
import multer from 'multer';
import { marketingController } from '../controllers/marketing.controller';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requirePlatformAdminAccess } from '../middlewares/requirePlatformAdminAccess';
import { requireBillingFeature } from '../middlewares/requireBillingFeature';

export const marketingRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

const requireMarketingAccess = [
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(requireBillingFeature('marketing'))
];

marketingRouter.get(
  '/platform/clients/:clientId/campaigns',
  ...requireMarketingAccess,
  asyncHandler(marketingController.listCampaigns)
);
marketingRouter.post(
  '/platform/clients/:clientId/campaigns',
  ...requireMarketingAccess,
  asyncHandler(marketingController.createCampaign)
);
marketingRouter.get(
  '/platform/clients/:clientId/campaigns/:campaignId',
  ...requireMarketingAccess,
  asyncHandler(marketingController.getCampaign)
);
marketingRouter.post(
  '/platform/clients/:clientId/campaigns/:campaignId/recipients/preview',
  ...requireMarketingAccess,
  asyncHandler(marketingController.previewRecipients)
);
marketingRouter.post(
  '/platform/clients/:clientId/campaigns/contacts/upload',
  ...requireMarketingAccess,
  upload.single('file'),
  asyncHandler(marketingController.uploadContactsCsv)
);
marketingRouter.post(
  '/platform/clients/:clientId/campaigns/:campaignId/send',
  ...requireMarketingAccess,
  asyncHandler(marketingController.sendCampaign)
);
marketingRouter.get(
  '/platform/clients/:clientId/campaign-templates/:templateType',
  ...requireMarketingAccess,
  asyncHandler(marketingController.getTemplate)
);
marketingRouter.put(
  '/platform/clients/:clientId/campaign-templates/:templateType',
  ...requireMarketingAccess,
  asyncHandler(marketingController.updateTemplate)
);

// Public tracking beacon — hit by anonymous visitors opening a campaign's
// booking link, no auth or billing gate (it just increments a counter).
marketingRouter.post(
  '/public/campaigns/:campaignId/open',
  asyncHandler(marketingController.trackLinkOpen)
);
