import { Router } from 'express';
import auth from '../middleware/auth.middleware';
import { listMyInvites, acceptInvite, declineInvite } from '../controller/collab.controller';

const router = Router();

router.use(auth);

// GET  /api/collab/invites
router.get('/invites', listMyInvites);

// POST /api/collab/invites/:inviteId/accept
router.post('/invites/:inviteId/accept', acceptInvite);

// POST /api/collab/invites/:inviteId/decline
router.post('/invites/:inviteId/decline', declineInvite);

export default router;
