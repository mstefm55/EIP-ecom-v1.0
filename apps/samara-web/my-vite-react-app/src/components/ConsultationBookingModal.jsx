import { createClientRecordId } from '../lib/runtimeDataGateway';
import { useRuntimeCollectionState } from '../context/RuntimeDataContext';
import { RUNTIME_DOMAINS } from '../lib/runtimeDomainContracts';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Calendar, Clock, User, Scissors, BookOpen, AlertCircle, CheckCircle2,
  ChevronLeft, ChevronRight, MessageSquare, Video, ArrowRight, Sparkles,
  Award, Trash2, CalendarCheck
} from 'lucide-react';
import { UI_LAYERS } from '../lib/uiLayers';

// Available time slots
const TIME_SLOTS = [
  '09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM',
  '10:15 AM', '10:30 AM', '11:00 AM', '11:15 AM',
  '02:00 PM', '02:15 PM', '02:30 PM', '03:00 PM',
  '03:45 PM', '04:00 PM', '04:15 PM', '04:30 PM'
];

export default function ConsultationBookingModal({
  isOpen,
  onClose,
  currentUser
}) {
  const [consultationExperts] = useRuntimeCollectionState(
    RUNTIME_DOMAINS.CONSULTATION_EXPERTS,
    []
  );
  const [appointments, setAppointments] = useRuntimeCollectionState(
    RUNTIME_DOMAINS.CONSULTATION_BOOKINGS,
    []
  );

  const [currentView, setCurrentView] = useState('book'); // 'book' | 'list'
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 18)); // Starting post-July 17, 2026
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');

  // Custom metadata for booking
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [targetGarment, setTargetGarment] = useState('Tailored Jacket');
  const [userNotes, setUserNotes] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [newlyBookedId, setNewlyBookedId] = useState(null);

  // Sync user email on load
  useEffect(() => {
    if (!selectedExpert && consultationExperts.length > 0) {
      setSelectedExpert(consultationExperts[0]);
    }
  }, [consultationExperts, selectedExpert]);

  // Sync user email on load
  useEffect(() => {
    if (currentUser?.email) {
      setUserEmail(currentUser.email);
    } else {
      setUserEmail('');
    }
  }, [currentUser]);

  // Keep date view healthy inside modal lifecycle
  useEffect(() => {
    if (isOpen) {
      setBookingSuccess(false);
      setNewlyBookedId(null);
      setSelectedDate(null);
      setSelectedTimeSlot('');
      setUserNotes('');
      setSkillLevel('Intermediate');
      setTargetGarment('Tailored Jacket');
      setCurrentView('book');
    }
  }, [isOpen]);

  // Calendar parameters
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(6); // July (0-indexed)

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
    setSelectedDate(null);
  };

  // Generate Calendar Days Array
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday
  };

  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDayIndex = getFirstDayOfMonth(calendarYear, calendarMonth);

  const calendarDays = [];
  // Blank pads
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(calendarYear, calendarMonth, d));
  }

  // Handle Book consultation action
  const handleBookConsultation = (e) => {
    e.preventDefault();
    if (!selectedExpert) {
      window.showToast?.("No consultation expert is currently available.", "error", "Availability Error");
      return;
    }
    if (!selectedDate) {
      if (window.showToast) {
        window.showToast("Please choose a date from the calendar widget first.", "error", "Selection Error");
      }
      return;
    }
    if (!selectedTimeSlot) {
      if (window.showToast) {
        window.showToast("Please choose a 15-minute time slot for your consultation.", "error", "Selection Error");
      }
      return;
    }

    const emailToUse = userEmail.trim() || currentUser?.email || '';

    // Unique Booking ID
    const clientId = createClientRecordId('consultation');
    const bookingCode = `ATEL-CONS-${clientId.slice(-8).toUpperCase()}`;

    const newAppointment = {
      id: clientId,
      displayReference: bookingCode,
      _clientPending: true,
      expert: selectedExpert,
      date: selectedDate.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }),
      rawDateStr: selectedDate.toISOString().split('T')[0],
      time: selectedTimeSlot,
      duration: '15 Minutes (1-on-1)',
      skillLevel,
      targetGarment,
      notes: userNotes,
      email: emailToUse,
      createdDate: new Date().toLocaleString(),
      meetingLink: `https://meet.google.com/sartorial-atelier-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`
    };

    setAppointments(prev => [newAppointment, ...prev]);
    setNewlyBookedId(clientId);
    setBookingSuccess(true);

    if (window.showToast) {
      window.showToast(
        `15-min briefing with ${selectedExpert?.name || ''} scheduled successfully! Check details.`,
        "success",
        "Consultation Booked"
      );
    }
  };

  const handleDeleteBooking = (id) => {
    setAppointments(prev => prev.filter(app => app.id !== id));
    if (window.showToast) {
      window.showToast("Consultation canceled successfully.", "info", "Canceled");
    }
  };

  // Check if calendar day is in the past relative to local time (July 17, 2026)
  const isDayPast = (day) => {
    if (!day) return true;
    const comparisonDate = new Date(2026, 6, 17); // Local benchmark
    comparisonDate.setHours(0,0,0,0);
    const target = new Date(day);
    target.setHours(0,0,0,0);
    return target <= comparisonDate;
  };

  // Is day weekend
  const isWeekend = (day) => {
    if (!day) return false;
    const dayOfWeek = day.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs cursor-pointer"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
            id="consultation-booking-backdrop"
          />

          {/* Modal Center Wrapper */}
          <div
            className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
            style={{ zIndex: UI_LAYERS.modal }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 210 }}
              className="bg-[#FAF8F5] border border-sand-250 shadow-lux rounded-lg w-full max-w-2xl flex flex-col pointer-events-auto max-h-[92vh] overflow-hidden"
              id="consultation-booking-modal-panel"
            >
              {/* Header */}
              <div className="p-5 bg-white border-b border-sand-200/80 flex items-center justify-between shrink-0" id="consultation-header">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-clay-50 border border-clay-100 flex items-center justify-center text-clay-700">
                    <CalendarCheck className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-bark-900 text-base leading-tight">{pfUiT("ui.components.consultationbookingmodal.fae649d402")}</h3>
                    <p className="text-[9.5px] font-mono uppercase tracking-wider text-bark-450 mt-0.5">{pfUiT("ui.components.consultationbookingmodal.2c2fabf9c4")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Quick view switcher */}
                  <div className="bg-sand-100 p-0.75 rounded flex text-[10px] font-mono font-bold uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView('book');
                        setBookingSuccess(false);
                      }}
                      className={`px-3 py-1 rounded cursor-pointer transition-all ${
                        currentView === 'book'
                          ? 'bg-white text-bark-900 shadow-3xs'
                          : 'text-bark-500 hover:text-bark-900'
                      }`}
                    >{pfUiT("ui.components.consultationbookingmodal.73660e5eed")}</button>
                    <button
                      type="button"
                      onClick={() => setCurrentView('list')}
                      className={`px-3 py-1 rounded cursor-pointer transition-all relative ${
                        currentView === 'list'
                          ? 'bg-white text-bark-900 shadow-3xs'
                          : 'text-bark-500 hover:text-bark-900'
                      }`}
                    >
                      <span>{pfUiT("ui.components.consultationbookingmodal.abb441fb03")}</span>
                      {appointments.length > 0 && (
                        <span className="absolute -top-1.5 -right-1 bg-clay-605 text-white text-[8px] px-1 rounded-full scale-90">
                          {appointments.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-sand-100 text-bark-500 hover:text-bark-900 transition-all cursor-pointer border border-transparent hover:border-sand-200/50"
                    id="btn-close-consultation-modal"
                    aria-label={pfUiT("ui.components.consultationbookingmodal.0a59de0f22")}
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6" id="consultation-modal-scroll-body">

                {/* VIEW 1: BOOKING WORKFLOW */}
                {currentView === 'book' && (
                  <div className="space-y-6" id="consultation-view-booking">

                    {!bookingSuccess ? (
                      <>
                        {/* Intro Card */}
                        <div className="bg-white border border-sand-200 rounded-[4px] p-4 flex gap-3.5 shadow-3xs">
                          <div className="w-10 h-10 rounded-full bg-clay-50 border border-clay-100 text-clay-705 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-serif font-bold text-bark-900 text-xs">Tailoring &amp; Blueprint Alignment</h4>
                            <p className="text-bark-550 text-[11px] leading-relaxed">{pfUiT("ui.components.consultationbookingmodal.a2cc10defd")}</p>
                          </div>
                        </div>

                        {/* Step 1: Expert Selection */}
                        <div className="space-y-2">
                          <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-450 block pb-1 border-b border-sand-150">{pfUiT("ui.components.consultationbookingmodal.3fe4c7cb09")}</span>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {consultationExperts.map((exp) => {
                              const isSelected = selectedExpert?.id === exp.id;
                              return (
                                <button
                                  key={exp.id}
                                  type="button"
                                  onClick={() => setSelectedExpert(exp)}
                                  className={`text-left bg-white border rounded-[4px] p-3 cursor-pointer transition-all flex md:flex-col items-center md:items-start gap-3 md:gap-2.5 relative ${
                                    isSelected
                                      ? 'border-[#ba6446] ring-2 ring-rose-50/70'
                                      : 'border-sand-200 hover:border-sand-300'
                                  }`}
                                  id={`expert-btn-${exp.id}`}
                                >
                                  {/* Expert Thumbnail */}
                                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-full border border-sand-200 overflow-hidden shrink-0">
                                    <img
                                      src={exp.image}
                                      alt={exp.name}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>

                                  <div className="space-y-0.5 flex-1 md:w-full">
                                    <div className="flex items-center justify-between gap-1.5">
                                      <h5 className="font-serif font-bold text-bark-900 text-[11.5px] leading-snug">{exp.name}</h5>
                                      {isSelected && (
                                        <span className="w-1.5 h-1.5 bg-[#ba6446] rounded-full shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-clay-705 font-mono text-[9px] font-semibold">{exp.role}</p>
                                    <p className="text-bark-450 text-[9px] font-sans md:line-clamp-2 mt-0.5 leading-snug hidden sm:block">
                                      {exp.bio}
                                    </p>
                                  </div>

                                  {/* Tags */}
                                  <div className="hidden md:flex flex-wrap gap-1 mt-1">
                                    {exp.tags.map(t => (
                                      <span key={t} className="bg-sand-100 text-bark-600 font-mono text-[7.5px] px-1.5 py-0.25 rounded">
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Double grid: Step 2 Calendar & Step 3 Times */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                          {/* Calendar Widget */}
                          <div className="space-y-2">
                            <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-450 block pb-1 border-b border-sand-150">{pfUiT("ui.components.consultationbookingmodal.42b26ebdda")}</span>

                            <div className="bg-white border border-sand-200 rounded-[4px] p-3.5 space-y-3.5" id="calendar-widget-wrapper">
                              {/* Calendar Nav */}
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-serif font-bold text-bark-900">
                                  {MONTH_NAMES[calendarMonth]} {calendarYear}
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={handlePrevMonth}
                                    className="p-1 rounded hover:bg-sand-100 text-bark-600 cursor-pointer"
                                    title={pfUiT("ui.components.consultationbookingmodal.6d1e2e81f5")}
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleNextMonth}
                                    className="p-1 rounded hover:bg-sand-100 text-bark-600 cursor-pointer"
                                    title={pfUiT("ui.components.consultationbookingmodal.8686024544")}
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Week Names */}
                              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[8px] font-bold uppercase tracking-wider text-bark-400">
                                <span>{pfUiT("ui.components.consultationbookingmodal.2c3f4fc673")}</span><span>{pfUiT("ui.components.consultationbookingmodal.2a017e9f87")}</span><span>{pfUiT("ui.components.consultationbookingmodal.cc67294bc5")}</span><span>{pfUiT("ui.components.consultationbookingmodal.5b3f7d97c5")}</span><span>{pfUiT("ui.components.consultationbookingmodal.a71f238c26")}</span><span>{pfUiT("ui.components.consultationbookingmodal.23780f55d7")}</span><span>{pfUiT("ui.components.consultationbookingmodal.53da8ec49c")}</span>
                              </div>

                              {/* Calendar Grid */}
                              <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((day, index) => {
                                  if (!day) return <div key={`empty-${index}`} className="aspect-square" />;

                                  const dayNum = day.getDate();
                                  const isPast = isDayPast(day);
                                  const isSelected = selectedDate && selectedDate.getDate() === dayNum && selectedDate.getMonth() === calendarMonth && selectedDate.getFullYear() === calendarYear;
                                  const isWeekendDay = isWeekend(day);

                                  return (
                                    <button
                                      key={`day-${dayNum}`}
                                      type="button"
                                      disabled={isPast || isWeekendDay}
                                      onClick={() => {
                                        setSelectedDate(day);
                                        setSelectedTimeSlot('');
                                      }}
                                      className={`aspect-square w-full rounded flex flex-col items-center justify-center text-[11px] font-mono transition-all relative ${
                                        isPast
                                          ? 'text-bark-300 bg-transparent cursor-not-allowed scale-90'
                                          : isWeekendDay
                                            ? 'text-rose-300 bg-rose-50/20 cursor-not-allowed text-[10px]'
                                            : isSelected
                                              ? 'bg-[#ba6446] text-white font-bold shadow-3xs hover:bg-[#ba6446]'
                                              : 'bg-sand-50/60 hover:bg-clay-50/70 text-bark-850 hover:text-clay-705 border border-sand-150/50 font-semibold cursor-pointer'
                                      }`}
                                      title={isWeekendDay ? 'Closed on weekends' : ''}
                                    >
                                      <span>{dayNum}</span>
                                      {/* Tiny marker if today benchmark July 17, 2026 */}
                                      {dayNum === 17 && calendarMonth === 6 && calendarYear === 2026 && (
                                        <span className="w-1 h-1 bg-clay-605 rounded-full absolute bottom-1" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Calendar Legend */}
                              <div className="flex items-center justify-between text-[8px] font-mono text-bark-450 border-t border-sand-100 pt-2 flex-wrap gap-1.5">
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded bg-sand-50/60 border border-sand-200" />
                                  <span>{pfUiT("ui.components.consultationbookingmodal.45c93a47b1")}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded bg-[#ba6446]" />
                                  <span>{pfUiT("ui.components.consultationbookingmodal.e6f7b16bfc")}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded bg-rose-50 border border-rose-200" />
                                  <span>Weekends (Closed)</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Time Slots Widget */}
                          <div className="space-y-2">
                            <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-450 block pb-1 border-b border-sand-150">{pfUiT("ui.components.consultationbookingmodal.ac07107547")}</span>

                            {selectedDate ? (
                              <div className="bg-white border border-sand-200 rounded-[4px] p-3.5 space-y-3.5 h-[245px] flex flex-col justify-between" id="time-slots-wrapper">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-mono uppercase text-bark-450 font-bold block">{pfUiT("ui.components.consultationbookingmodal.30849a620d")}</span>
                                  <h6 className="font-serif font-bold text-bark-900 text-xs">
                                    {selectedDate.toLocaleDateString('en-US', {
                                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                    })}
                                  </h6>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 overflow-y-auto max-h-[140px] pr-1.5 py-0.5">
                                  {TIME_SLOTS.map((time) => {
                                    const isSlotSelected = selectedTimeSlot === time;

                                    // Generate a pseudo-booked logic based on date and time for realism
                                    const hashNum = (selectedDate.getDate() + time.charCodeAt(0)) % 7;
                                    const isBooked = hashNum === 0 || hashNum === 3;

                                    return (
                                      <button
                                        key={time}
                                        type="button"
                                        disabled={isBooked}
                                        onClick={() => setSelectedTimeSlot(time)}
                                        className={`py-1.5 text-center text-[10.5px] font-mono rounded-[3px] border transition-all ${
                                          isBooked
                                            ? 'bg-sand-100 border-sand-150 text-bark-300 cursor-not-allowed line-through'
                                            : isSlotSelected
                                              ? 'bg-[#ba6446] border-[#ba6446] text-white font-bold shadow-3xs'
                                              : 'bg-white border-sand-200 hover:border-clay-300 hover:text-clay-705 hover:bg-clay-50/40 text-bark-800 font-semibold cursor-pointer'
                                        }`}
                                      >
                                        {time} {isBooked && '(Filled)'}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="text-[9px] font-mono text-bark-450 italic text-center pt-2 border-t border-sand-100">{pfUiT("ui.components.consultationbookingmodal.c2f22b7bf9")}</div>
                              </div>
                            ) : (
                              <div className="bg-sand-50/50 border border-dashed border-sand-250 rounded-[4px] p-5 h-[245px] flex flex-col items-center justify-center text-center space-y-2">
                                <Calendar className="w-7 h-7 text-bark-300" />
                                <div className="space-y-0.5">
                                  <p className="text-xs font-bold text-bark-800 font-serif">{pfUiT("ui.components.consultationbookingmodal.1fc4a3bb38")}</p>
                                  <p className="text-[10px] text-bark-450 max-w-xs mx-auto leading-relaxed">{pfUiT("ui.components.consultationbookingmodal.ad9058e5ab")}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 4: Metadata Form */}
                        <form onSubmit={handleBookConsultation} className="space-y-4 pt-1">
                          <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-450 block pb-1 border-b border-sand-150">{pfUiT("ui.components.consultationbookingmodal.5b2baf7a07")}</span>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Skill level */}
                            <div className="space-y-1">
                              <label htmlFor="input-skill-level" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">{pfUiT("ui.components.consultationbookingmodal.d63bc7ae8c")}</label>
                              <select
                                id="input-skill-level"
                                value={skillLevel}
                                onChange={(e) => setSkillLevel(e.target.value)}
                                className="w-full bg-white border border-sand-250 text-xs px-3 py-2 rounded-[4px] focus:outline-none focus:border-clay-500 text-bark-850 font-sans"
                              >
                                <option value="Beginner (First garment)">Beginner (First garment)</option>
                                <option value="Intermediate">Intermediate (Understands seam allowances)</option>
                                <option value="Advanced Craftsperson">Advanced Craftsperson (Custom bodice draping)</option>
                                <option value="Haute Couture / Professional">{pfUiT("ui.components.consultationbookingmodal.17f107b5af")}</option>
                              </select>
                            </div>

                            {/* Target Garment */}
                            <div className="space-y-1">
                              <label htmlFor="input-target-garment" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">{pfUiT("ui.components.consultationbookingmodal.854903f97d")}</label>
                              <select
                                id="input-target-garment"
                                value={targetGarment}
                                onChange={(e) => setTargetGarment(e.target.value)}
                                className="w-full bg-white border border-sand-250 text-xs px-3 py-2 rounded-[4px] focus:outline-none focus:border-clay-500 text-bark-850 font-sans"
                              >
                                <option value="Aurelia Wrap Dress">{pfUiT("ui.components.consultationbookingmodal.bb36dff41d")}</option>
                                <option value="Tailored Tailcoat Jacket">{pfUiT("ui.components.consultationbookingmodal.b90dcca4bb")}</option>
                                <option value="Wide Leg Palazzo Trousers">{pfUiT("ui.components.consultationbookingmodal.95e36b9efd")}</option>
                                <option value="Asymmetric Slip Dress Series">{pfUiT("ui.components.consultationbookingmodal.c1dff2b6cd")}</option>
                                <option value="Custom Fit Adjustments">{pfUiT("ui.components.consultationbookingmodal.e9700be5e4")}</option>
                                <option value="Fabric Yardage & Grainlines">{pfUiT("ui.components.consultationbookingmodal.8163d7ab8e")}</option>
                              </select>
                            </div>
                          </div>

                          {/* Email prefill */}
                          <div className="space-y-1">
                            <label htmlFor="input-booking-email" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">{pfUiT("ui.components.consultationbookingmodal.fc27059093")}</label>
                            <input
                              id="input-booking-email"
                              type="email"
                              required
                              placeholder={pfUiT("ui.components.consultationbookingmodal.a9332947b0")}
                              value={userEmail}
                              onChange={(e) => setUserEmail(e.target.value)}
                              className="w-full bg-white border border-sand-250 text-xs px-3 py-2 rounded-[4px] focus:outline-none focus:border-clay-500 text-bark-850 font-mono"
                            />
                            <p className="text-[9px] text-bark-450 italic font-sans leading-relaxed">{pfUiT("ui.components.consultationbookingmodal.459b8d6f3b")}</p>
                          </div>

                          {/* Notes */}
                          <div className="space-y-1">
                            <label htmlFor="input-booking-notes" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                              Specific Drafting Challenges or Custom Questions (Optional):
                            </label>
                            <textarea
                              id="input-booking-notes"
                              rows={2}
                              value={userNotes}
                              onChange={(e) => setUserNotes(e.target.value)}
                              placeholder={pfUiT("ui.components.consultationbookingmodal.b5ab877b4f")}
                              className="w-full bg-white border border-sand-250 text-xs p-3 rounded-[4px] focus:outline-none focus:border-clay-500 text-bark-850 font-sans placeholder-bark-400"
                            />
                          </div>

                          {/* Action Button */}
                          <button
                            type="submit"
                            className="w-full py-3 bg-bark-900 hover:bg-bark-955 text-sand-50 text-xs font-bold uppercase tracking-widest rounded-[4px] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-3xs active:scale-[0.99]"
                            id="btn-confirm-consultation-booking"
                          >
                            <CalendarCheck className="w-4 h-4 text-clay-300" />
                            <span>{pfUiT("ui.components.consultationbookingmodal.2271d25563")}</span>
                          </button>
                        </form>
                      </>
                    ) : (
                      /* SUCCESS VIEW */
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-50/50 border border-emerald-200 rounded-[4px] p-6 text-center space-y-4"
                        id="consultation-success-panel"
                      >
                        <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-700 font-bold bg-emerald-100/70 px-2.5 py-0.5 rounded-full inline-block">{pfUiT("ui.components.consultationbookingmodal.4fe8bb9211")}</span>
                          <h4 className="font-serif font-bold text-emerald-950 text-base">{pfUiT("ui.components.consultationbookingmodal.9f34569d1d")}</h4>
                          <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed font-sans">{pfUiT("ui.components.consultationbookingmodal.91cb839754")}</p>
                        </div>

                        {/* Booking Ticket Detail Card */}
                        {appointments.find(app => app.id === newlyBookedId) && (() => {
                          const app = appointments.find(app => app.id === newlyBookedId);
                          return (
                            <div className="bg-white border border-sand-250 p-4.5 rounded text-left space-y-3.5 max-w-md mx-auto shadow-lux relative overflow-hidden">
                              {/* Decorative side slashes */}
                              <div className="absolute top-0 right-0 w-16 h-16 bg-sand-100 rotate-45 translate-x-8 -translate-y-8 border-b border-sand-200" />

                              <div className="flex gap-3 items-start border-b border-sand-150 pb-3">
                                <div className="w-10 h-10 rounded-full border border-sand-200 overflow-hidden shrink-0">
                                  <img
                                    src={app.expert.image}
                                    alt={exp => app.expert.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <h5 className="font-serif font-bold text-bark-900 text-xs">{app.expert.name}</h5>
                                  <p className="text-clay-705 font-mono text-[9px] font-bold uppercase tracking-wider">{app.expert.role}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-mono text-bark-450 uppercase block font-semibold">{pfUiT("ui.components.consultationbookingmodal.039c8f2ed3")}</span>
                                  <span className="text-bark-900 font-semibold">{app.date}</span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-mono text-bark-450 uppercase block font-semibold">{pfUiT("ui.components.consultationbookingmodal.028347d03c")}</span>
                                  <span className="text-bark-900 font-semibold font-mono">{app.time} (15 mins)</span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-mono text-bark-450 uppercase block font-semibold">{pfUiT("ui.components.consultationbookingmodal.0db2c53187")}</span>
                                  <span className="text-bark-900 font-semibold">{app.targetGarment}</span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-mono text-bark-450 uppercase block font-semibold">{pfUiT("ui.components.consultationbookingmodal.487fff9269")}</span>
                                  <span className="text-bark-900 font-bold font-mono">{app.id}</span>
                                </div>
                              </div>

                              {/* Virtual link info */}
                              <div className="bg-sand-50 border border-sand-200/60 p-2.5 rounded text-[10.5px] flex items-center gap-2 text-bark-750">
                                <Video className="w-4 h-4 text-clay-605 shrink-0" />
                                <div className="truncate">
                                  <span className="font-bold block text-[8px] font-mono uppercase text-bark-450">{pfUiT("ui.components.consultationbookingmodal.7a8c625b55")}</span>
                                  <a href={app.meetingLink} target="_blank" rel="noopener noreferrer" className="text-clay-605 hover:underline truncate block font-mono font-bold">
                                    {app.meetingLink}
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex gap-2 justify-center pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setBookingSuccess(false);
                              setNewlyBookedId(null);
                              setSelectedDate(null);
                              setSelectedTimeSlot('');
                              setUserNotes('');
                            }}
                            className="px-4 py-2 bg-white border border-sand-250 hover:bg-sand-50 text-bark-800 text-xs font-semibold rounded cursor-pointer transition-colors"
                          >{pfUiT("ui.components.consultationbookingmodal.86cbc61b1d")}</button>
                          <button
                            type="button"
                            onClick={() => setCurrentView('list')}
                            className="px-4 py-2 bg-bark-900 hover:bg-bark-955 text-sand-50 text-xs font-semibold rounded cursor-pointer transition-colors"
                          >{pfUiT("ui.components.consultationbookingmodal.581d40ba5a")}</button>
                        </div>
                      </motion.div>
                    )}

                  </div>
                )}

                {/* VIEW 2: APPOINTMENTS LIST */}
                {currentView === 'list' && (
                  <div className="space-y-5" id="consultation-view-list">
                    <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-450 block pb-1 border-b border-sand-150">
                      Your Registered Consultation History ({appointments.length})
                    </span>

                    {appointments.length > 0 ? (
                      <div className="space-y-4">
                        {appointments.map((app) => (
                          <div
                            key={app.id}
                            className="bg-white border border-sand-200 p-4 rounded-[4px] shadow-3xs flex flex-col md:flex-row gap-4 justify-between items-start md:items-center relative"
                            id={`app-card-${app.id}`}
                          >
                            <div className="flex gap-3.5 items-start">
                              <div className="w-10 h-10 rounded-full border border-sand-200 overflow-hidden shrink-0 mt-0.5">
                                <img
                                  src={app.expert.image}
                                  alt={app.expert.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-x-2">
                                  <h5 className="font-serif font-bold text-bark-900 text-xs">{app.expert.name}</h5>
                                  <span className="text-[8px] px-1.5 py-0.25 bg-sand-100 text-bark-550 border border-sand-200 rounded font-mono font-bold">
                                    {app.id}
                                  </span>
                                </div>
                                <p className="text-clay-705 font-mono text-[9px] font-bold uppercase tracking-wider">{app.expert.role}</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] font-sans text-bark-650 pt-1">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-bark-400 shrink-0" />
                                    <b>{app.date}</b>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-bark-400 shrink-0" />
                                    <span>{pfUiT("ui.components.consultationbookingmodal.f4e1d88135")}<b className="font-mono text-bark-900">{app.time}</b></span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Scissors className="w-3.5 h-3.5 text-bark-400 shrink-0" />
                                    <span>{pfUiT("ui.components.consultationbookingmodal.8b0a0b10fc")}<b>{app.targetGarment}</b></span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Award className="w-3.5 h-3.5 text-bark-400 shrink-0" />
                                    <span>{pfUiT("ui.components.consultationbookingmodal.2049e166c7")}<b>{app.skillLevel}</b></span>
                                  </span>
                                </div>

                                {app.notes && (
                                  <div className="mt-2 bg-sand-50/50 p-2 border border-sand-150 rounded text-[10px] text-bark-600 font-serif italic">
                                    " {app.notes} "
                                  </div>
                                )}

                                {/* Video Meeting Box */}
                                <div className="mt-2.5 flex items-center gap-2 bg-rose-50/20 border border-rose-100 rounded px-2.5 py-1.5 text-[10.5px] max-w-sm">
                                  <Video className="w-4 h-4 text-clay-605 shrink-0" />
                                  <div className="truncate">
                                    <span className="font-mono font-bold text-[8.5px] uppercase text-bark-450 block">{pfUiT("ui.components.consultationbookingmodal.e7dfcf66ba")}</span>
                                    <a href={app.meetingLink} target="_blank" rel="noopener noreferrer" className="text-clay-605 hover:underline truncate font-mono font-bold">
                                      {app.meetingLink}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Canceled button */}
                            <div className="self-stretch md:self-auto flex items-center justify-end border-t md:border-t-0 border-sand-150 pt-3 md:pt-0 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDeleteBooking(app.id)}
                                className="px-3 py-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-mono text-[9.5px] uppercase font-bold rounded transition-colors cursor-pointer flex items-center gap-1"
                                title={pfUiT("ui.components.consultationbookingmodal.4ee2bbb7b5")}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{pfUiT("ui.components.consultationbookingmodal.88d6e2496f")}</span>
                              </button>
                            </div>

                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white border border-sand-200 rounded-[4px] p-8 text-center space-y-3" id="consultation-empty-list">
                        <Calendar className="w-9 h-9 text-bark-300 mx-auto" />
                        <div className="space-y-1">
                          <h4 className="font-serif font-bold text-bark-900 text-sm">{pfUiT("ui.components.consultationbookingmodal.bd1804f60b")}</h4>
                          <p className="text-xs text-bark-500 max-w-xs mx-auto leading-relaxed font-sans">{pfUiT("ui.components.consultationbookingmodal.2540374854")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentView('book')}
                          className="px-4 py-2 bg-bark-900 hover:bg-bark-955 text-sand-50 text-xs font-semibold rounded cursor-pointer inline-flex items-center gap-1.5 shadow-3xs"
                        >
                          <span>{pfUiT("ui.components.consultationbookingmodal.d0e9f882f5")}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="p-4 bg-white border-t border-sand-200 flex justify-between items-center shrink-0" id="consultation-footer">
                <span className="text-[10px] text-bark-450 font-serif italic flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-clay-605" />
                  <span>{pfUiT("ui.components.consultationbookingmodal.435bff609d")}</span>
                </span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-sand-100 hover:bg-sand-200 text-bark-850 rounded text-xs font-semibold cursor-pointer"
                  id="btn-close-consultation-footer"
                  type="button"
                >{pfUiT("ui.components.consultationbookingmodal.d910dfbe65")}</button>
              </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
