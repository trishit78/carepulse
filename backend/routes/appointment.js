import express from 'express';
import {
  createAppointment,
  getUserAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment
} from '../controllers/appointmentController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All appointment routes require authentication
router.use(authenticateToken);

router.post('/', createAppointment);
router.get('/', getUserAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id', updateAppointmentStatus);
router.post('/:id/cancel', cancelAppointment);

export default router;

