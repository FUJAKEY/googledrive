import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authRouter } from './auth.js';
import { driveRouter } from './drive.js';
import { activityRouter } from './activity.js';
import { shareApiRouter } from './share.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/drive', requireAuth, driveRouter);
router.use('/activity', requireAuth, activityRouter);
router.use('/share', requireAuth, shareApiRouter);

export { router as apiRouter };
