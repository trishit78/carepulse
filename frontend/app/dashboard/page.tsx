'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doctorAPI, appointmentAPI, Doctor, Appointment, AppointmentCountsByDate } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, signout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingData, setBookingData] = useState({
    appointmentDate: '',
    appointmentTime: '',
    reason: '',
    comments: ''
  });
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  const [doctorFormOpen, setDoctorFormOpen] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    email: '',
    password: '',
    specialization: '',
    experience: 0,
    consultationFee: 0,
    bio: '',
    qualifications: '',
  });
  const [doctorFormError, setDoctorFormError] = useState('');
  const [doctorFormLoading, setDoctorFormLoading] = useState(false);
  const [appointmentCounts, setAppointmentCounts] = useState<AppointmentCountsByDate[]>([]);

  const loadAppointments = useCallback(async () => {
    try {
      const scope = user?.role === 'doctor' ? 'doctor' : undefined;
      const response = await appointmentAPI.getAll(undefined, scope, user?.role === 'doctor');
      if (response.success) {
        setAppointments(response.data);
        setAppointmentCounts(response.countsByDate || []);
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoadingAppointments(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAppointments();
    }
  }, [isAuthenticated, loadAppointments]);

  const { data: doctors = [], isLoading: loadingDoctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const response = await doctorAPI.getAll();
      return response.data || [];
    },
    enabled: isAuthenticated,
  });

  const createDoctorMutation = useMutation({
    mutationFn: async (payload: {
      userId: string;
      specialization: string;
      experience: number;
      bio?: string;
      consultationFee: number;
      qualifications?: Array<{ degree: string; institution?: string; year?: number }>;
    }) => doctorAPI.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
  });

  const handleBookAppointment = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setShowBookingForm(true);
    setBookingError('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setBookingData({
      appointmentDate: tomorrow.toISOString().split('T')[0],
      appointmentTime: '10:00',
      reason: '',
      comments: ''
    });
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    
    if (!selectedDoctor || !bookingData.appointmentDate || !bookingData.appointmentTime || !bookingData.reason) {
      setBookingError('Please fill in all required fields');
      return;
    }

    setBookingLoading(true);
    try {
      const response = await appointmentAPI.create({
        doctorId: selectedDoctor._id,
        appointmentDate: bookingData.appointmentDate,
        appointmentTime: bookingData.appointmentTime,
        reason: bookingData.reason,
        comments: bookingData.comments
      });

      if (response.success) {
        setShowBookingForm(false);
        setSelectedDoctor(null);
        setBookingData({ appointmentDate: '', appointmentTime: '', reason: '', comments: '' });
        loadAppointments();
      } else {
        setBookingError(response.message || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Booking error:', error);
      setBookingError('Network error. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      const response = await appointmentAPI.cancel(appointmentId);
      if (response.success) {
        loadAppointments();
      } else {
        alert(response.message || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Cancel appointment error:', error);
      alert('Error cancelling appointment');
    }
  };

  const handleStartCall = async (appointmentId: string) => {
    try {
      const response = await appointmentAPI.startCall(appointmentId);
      if (response.success && response.joinUrl) {
        window.open(response.joinUrl, '_blank');
        // Refresh appointments to update UI
        loadAppointments();
      } else {
        alert(response.message || 'Failed to start call');
      }
    } catch (error) {
      console.error('Start call error:', error);
      alert('Error starting call. Please try again.');
    }
  };

  const handleJoinCall = async (appointmentId: string) => {
    try {
      const response = await appointmentAPI.joinCall(appointmentId);
      if (response.success && response.joinUrl) {
        window.open(response.joinUrl, '_blank');
      } else {
        alert(response.message || 'Failed to join call');
      }
    } catch (error) {
      console.error('Join call error:', error);
      alert('Error joining call. Please try again.');
    }
  };

  const handleOpenDoctorForm = () => {
    setDoctorFormOpen(true);
    setDoctorFormError('');
    setDoctorForm({
      name: '',
      email: '',
      password: '',
      specialization: '',
      experience: 0,
      consultationFee: 0,
      bio: '',
      qualifications: '',
    });
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setDoctorFormError('');

    if (!doctorForm.name || !doctorForm.email || !doctorForm.password || !doctorForm.specialization) {
      setDoctorFormError('Please fill in all required fields');
      return;
    }

    setDoctorFormLoading(true);
    try {
      const signupRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: doctorForm.email,
          password: doctorForm.password,
          name: doctorForm.name,
        }),
      });
      const signupData = await signupRes.json();
      if (!signupData.success || !signupData.data?.user?.id) {
        throw new Error(signupData.message || 'Failed to create user');
      }

      const userId = signupData.data.user.id;
      const qualificationsArray = doctorForm.qualifications
        ? doctorForm.qualifications.split(',').map(q => ({ degree: q.trim() })).filter(q => q.degree)
        : [];

      const res = await createDoctorMutation.mutateAsync({
        userId,
        specialization: doctorForm.specialization,
        experience: Number(doctorForm.experience) || 0,
        bio: doctorForm.bio || undefined,
        consultationFee: Number(doctorForm.consultationFee) || 0,
        qualifications: qualificationsArray,
      });

      if (!res.success) {
        throw new Error(res.message || 'Failed to create doctor');
      }

      setDoctorFormOpen(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error creating doctor';
      setDoctorFormError(message);
    } finally {
      setDoctorFormLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return '✓';
      case 'pending':
        return '⏳';
      case 'cancelled':
        return '⚠';
      default:
        return '•';
    }
  };

  const stats = {
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    pending: appointments.filter(a => a.status === 'pending').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isDoctor = user?.role === 'doctor';
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysAppointments = isDoctor
    ? appointments
        .filter((a) => a.appointmentDate.slice(0, 10) === todayStr)
        .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
    : [];

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <nav className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">CarePulse</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user?.role === 'admin' && (
                <button
                  onClick={handleOpenDoctorForm}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Add Doctor
                </button>
              )}
              <span className="text-sm text-gray-300">
                {user?.name || user?.email}
              </span>
              <button
                onClick={signout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-2">
            Welcome 👋
          </h2>
          <p className="text-gray-400">
            {isDoctor ? 'Manage today’s consultations and view your schedule.' : 'Start the day with managing new appointments.'}
          </p>
        </div>

        {isDoctor ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-800 rounded-lg p-6">
                <p className="text-4xl font-bold">{todaysAppointments.length}</p>
                <p className="text-gray-400 mt-2">Today&apos;s bookings</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-6">
                <p className="text-4xl font-bold">
                  {appointmentCounts.reduce((acc, c) => acc + c.count, 0)}
                </p>
                <p className="text-gray-400 mt-2">Total upcoming</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-6">
                <p className="text-4xl font-bold">
                  {appointmentCounts[0]?.count || 0}
                </p>
                <p className="text-gray-400 mt-2">Earliest day load</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-800 rounded-lg p-6 lg:col-span-2">
                <h3 className="text-2xl font-bold mb-4">Today&apos;s bookings</h3>
                {loadingAppointments ? (
                  <div className="text-gray-400">Loading...</div>
                ) : todaysAppointments.length === 0 ? (
                  <div className="text-gray-400">No bookings for today.</div>
                ) : (
                  <div className="space-y-4">
                    {todaysAppointments.map((a) => (
                      <div key={a._id} className="bg-zinc-900 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <p className="text-lg font-semibold">{a.patient.name}</p>
                            <p className="text-gray-400 text-sm">{a.reason}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-300">
                              {new Date(a.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(a.status)}`}>
                              {getStatusIcon(a.status)} {a.status}
                            </span>
                          </div>
                        </div>
                        {a.status !== 'cancelled' && a.status !== 'completed' && (
                          <button
                            onClick={() => handleStartCall(a._id)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors"
                          >
                            Start Call (Host)
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="text-2xl font-bold mb-4">Calendar load</h3>
                {appointmentCounts.length === 0 ? (
                  <div className="text-gray-400">No upcoming bookings.</div>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto">
                    {appointmentCounts.map((c) => (
                      <div key={c.date} className="flex items-center justify-between bg-zinc-900 rounded-md px-3 py-2">
                        <span className="text-sm text-gray-200">{c.date}</span>
                        <span className="text-sm font-semibold text-blue-400">{c.count} bookings</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-bold">{stats.scheduled}</p>
                    <p className="text-gray-400 mt-2">Scheduled appointments</p>
                  </div>
                  <div className="text-4xl">📅</div>
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-bold">{stats.pending}</p>
                    <p className="text-gray-400 mt-2">Pending appointments</p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-bold">{stats.cancelled}</p>
                    <p className="text-gray-400 mt-2">Cancelled appointments</p>
                  </div>
                  <div className="text-4xl">⚠️</div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4">Available Doctors</h3>
              {loadingDoctors ? (
                <div className="text-gray-400">Loading doctors...</div>
              ) : doctors.length === 0 ? (
                <div className="text-gray-400">No doctors available at the moment.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {doctors.map((doctor) => (
                    <div key={doctor._id} className="bg-zinc-800 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-xl font-semibold">{doctor.user.name}</h4>
                          <p className="text-blue-400">{doctor.specialization}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">${doctor.consultationFee}</p>
                          <p className="text-sm text-yellow-400">⭐ {doctor.rating.average.toFixed(1)}</p>
                        </div>
                      </div>
                      {doctor.bio && (
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{doctor.bio}</p>
                      )}
                      <p className="text-sm text-gray-500 mb-4">{doctor.experience} years of experience</p>
                      <button
                        onClick={() => handleBookAppointment(doctor)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                      >
                        Book Appointment
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {doctorFormOpen && user?.role === 'admin' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-800 rounded-lg p-6 max-w-lg w-full max-height-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold">Add Doctor</h3>
                <button
                  onClick={() => setDoctorFormOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {doctorFormError && (
                <div className="bg-red-900/50 border border-red-700 rounded-md p-3 mb-4">
                  <p className="text-red-200 text-sm">{doctorFormError}</p>
                </div>
              )}

              <form onSubmit={handleCreateDoctor} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name *</label>
                    <input
                      type="text"
                      value={doctorForm.name}
                      onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email *</label>
                    <input
                      type="email"
                      value={doctorForm.email}
                      onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password *</label>
                  <input
                    type="password"
                    value={doctorForm.password}
                    onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Specialization *</label>
                    <input
                      type="text"
                      value={doctorForm.specialization}
                      onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Experience (years)</label>
                    <input
                      type="number"
                      value={doctorForm.experience}
                      onChange={(e) => setDoctorForm({ ...doctorForm, experience: Number(e.target.value) })}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                      min={0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Consultation Fee</label>
                    <input
                      type="number"
                      value={doctorForm.consultationFee}
                      onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: Number(e.target.value) })}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Qualifications (comma separated)</label>
                    <input
                      type="text"
                      value={doctorForm.qualifications}
                      onChange={(e) => setDoctorForm({ ...doctorForm, qualifications: e.target.value })}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                      placeholder="e.g. MD, MBBS"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Bio</label>
                  <textarea
                    value={doctorForm.bio}
                    onChange={(e) => setDoctorForm({ ...doctorForm, bio: e.target.value })}
                    rows={3}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                    placeholder="Short description"
                  />
                </div>

                <button
                  type="submit"
                  disabled={doctorFormLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {doctorFormLoading ? 'Saving...' : 'Save Doctor'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showBookingForm && selectedDoctor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold">New Appointment</h3>
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setSelectedDoctor(null);
                    setBookingError('');
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-400 mb-4">
                Request a new appointment with {selectedDoctor.user.name}
              </p>

              {bookingError && (
                <div className="bg-red-900/50 border border-red-700 rounded-md p-3 mb-4">
                  <p className="text-red-200 text-sm">{bookingError}</p>
                </div>
              )}

              <form onSubmit={handleSubmitBooking} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Doctor</label>
                  <input
                    type="text"
                    value={selectedDoctor.user.name}
                    disabled
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Expected appointment date *
                  </label>
                  <input
                    type="date"
                    value={bookingData.appointmentDate}
                    onChange={(e) => setBookingData({ ...bookingData, appointmentDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Appointment time *
                  </label>
                  <input
                    type="time"
                    value={bookingData.appointmentTime}
                    onChange={(e) => setBookingData({ ...bookingData, appointmentTime: e.target.value })}
                    required
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Appointment reason *
                  </label>
                  <textarea
                    value={bookingData.reason}
                    onChange={(e) => setBookingData({ ...bookingData, reason: e.target.value })}
                    required
                    rows={3}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                    placeholder="Describe the reason for your appointment"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Comments/notes
                  </label>
                  <textarea
                    value={bookingData.comments}
                    onChange={(e) => setBookingData({ ...bookingData, comments: e.target.value })}
                    rows={3}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-md px-3 py-2 text-white"
                    placeholder="Any additional notes or preferences"
                  />
                </div>

                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bookingLoading ? 'Submitting...' : 'Submit Appointment'}
                </button>
              </form>
            </div>
          </div>
        )}

        {!isDoctor && (
          <div className="bg-zinc-800 rounded-lg overflow-hidden">
            <div className="p-6 border-b border-zinc-700">
              <h3 className="text-2xl font-bold">Your Appointments</h3>
            </div>
            {loadingAppointments ? (
              <div className="p-6 text-gray-400">Loading appointments...</div>
            ) : appointments.length === 0 ? (
              <div className="p-6 text-gray-400">No appointments yet. Book your first appointment above!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Appointment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Doctor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-700">
                    {appointments.map((appointment, index) => (
                      <tr key={appointment._id} className="hover:bg-zinc-700/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {appointment.patient.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(appointment.status)}`}>
                            {getStatusIcon(appointment.status)} {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-medium mr-2">
                              {appointment.doctor.user.name.charAt(0)}
                            </div>
                            <span className="text-sm">Dr. {appointment.doctor.user.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                            <button
                              onClick={() => handleCancelAppointment(appointment._id)}
                              className="text-red-400 hover:text-red-300 mr-4"
                            >
                              Cancel
                            </button>
                          )}
                          {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                            <button
                              onClick={() => handleJoinCall(appointment._id)}
                              className="text-green-400 hover:text-green-300"
                            >
                              Join Call
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
