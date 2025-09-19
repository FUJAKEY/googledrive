import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toActivityResponse } from '../utils/drive.js';

export const activityRouter = Router();

activityRouter.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const activities = await prisma.activity.findMany({
      where: { actorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return res.json({ activities: activities.map(toActivityResponse) });
  } catch (error) {
    next(error);
  }
});
