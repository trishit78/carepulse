import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import User from '../models/User.js';

// Create appointment
export const createAppointment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { doctorId, appointmentDate, appointmentTime, reason, comments } = req.body;

    // Validation
    if (!doctorId || !appointmentDate || !appointmentTime || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Doctor, appointment date, time, and reason are required'
      });
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or not available'
      });
    }

    // Combine date and time
    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);

    // Check if appointment date is in the future
    if (appointmentDateTime < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date must be in the future'
      });
    }

    // Check for conflicting appointments
    const conflictingAppointment = await Appointment.findOne({
      doctor: doctorId,
      appointmentDate: appointmentDateTime,
      status: { $in: ['pending', 'scheduled'] }
    });

    if (conflictingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'Doctor is not available at this time'
      });
    }

    // Create appointment
    const appointment = await Appointment.create({
      patient: userId,
      doctor: doctorId,
      appointmentDate: appointmentDateTime,
      appointmentTime,
      reason,
      comments: comments || '',
      status: 'pending'
    });

    // Populate doctor and patient details
    await appointment.populate('doctor');
    await appointment.populate('patient');

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating appointment',
      error: error.message
    });
  }
};

// Get user's appointments
export const getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    let query = { patient: userId };
    
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: -1 })
      .limit(50);

    res.json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments'
    });
  }
};

// Get single appointment
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const appointment = await Appointment.findById(id).populate({
      path: 'doctor',
      populate: { path: 'user' }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if user is the patient or doctor
    const doctorUserId = appointment.doctor?.user?._id?.toString() || appointment.doctor?.user?.toString();
    if (appointment.patient.toString() !== userId && doctorUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this appointment'
      });
    }

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment'
    });
  }
};

// Update appointment status
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { status, videoCallLink, meetingId, notes, prescription } = req.body;

    const appointment = await Appointment.findById(id).populate({
      path: 'doctor',
      populate: { path: 'user' }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check authorization
    const doctorUserId = appointment.doctor?.user?._id?.toString() || appointment.doctor?.user?.toString();
    if (appointment.patient.toString() !== userId && doctorUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this appointment'
      });
    }

    // Update fields
    if (status) appointment.status = status;
    if (videoCallLink) appointment.videoCallLink = videoCallLink;
    if (meetingId) appointment.meetingId = meetingId;
    if (notes) appointment.notes = notes;
    if (prescription) appointment.prescription = prescription;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating appointment',
      error: error.message
    });
  }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const appointment = await Appointment.findById(id).populate({
      path: 'doctor',
      populate: { path: 'user' }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check authorization (patient, doctor, or admin)
    const doctorUserId = appointment.doctor?.user?._id?.toString() || appointment.doctor?.user?.toString();
    const requesterRole = req.user?.role;
    const isAdmin = requesterRole === 'admin';
    if (!isAdmin && appointment.patient.toString() !== userId && doctorUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel this appointment'
      });
    }

    // Check if appointment can be cancelled
    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed appointment'
      });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment'
    });
  }
};

