import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Event, UserProfile } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Filter,
  Globe,
  Map as MapIcon,
  MapPin,
  Ticket,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { cn, formatDate, formatDateTime, formatTime } from '../lib/utils';

type ReservationFeedback =
  | { type: 'success'; title: string; message: string }
  | { type: 'error'; title: string; message: string }
  | { type: 'info'; title: string; message: string }
  | null;

export default function EventsBoard({ currentUser }: { currentUser?: UserProfile }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const [userRegistrations, setUserRegistrations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'virtual' | 'in-person'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedFilterType, setAppliedFilterType] = useState<'all' | 'virtual' | 'in-person'>('all');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{ id: string; title: string } | null>(null);
  const [eventToRSVP, setEventToRSVP] = useState<Event | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [reservationReviewEvent, setReservationReviewEvent] = useState<Event | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [cancellingReservation, setCancellingReservation] = useState(false);
  const [feedback, setFeedback] = useState<ReservationFeedback>(null);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() } as Event));
        setEvents(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'events');
        setLoading(false);
        setFeedback({
          type: 'error',
          title: 'Event feed unavailable',
          message: 'We could not load the event board. Please try again shortly.',
        });
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'attendees'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const nextCounts: Record<string, number> = {};
        const nextRegistrations = new Set<string>();

        snap.docs.forEach((attendeeDoc) => {
          const data = attendeeDoc.data() as { eventId: string; userId: string };
          if (!data.eventId) return;
          nextCounts[data.eventId] = (nextCounts[data.eventId] || 0) + 1;
          if (currentUser?.userId && data.userId === currentUser.userId) {
            nextRegistrations.add(data.eventId);
          }
        });

        setAttendeeCounts(nextCounts);
        setUserRegistrations(nextRegistrations);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'events/*/attendees');
      }
    );

    return unsubscribe;
  }, [currentUser?.userId]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesType = appliedFilterType === 'all' || event.type === appliedFilterType;
      const eventDate = event.date instanceof Date ? event.date : (event.date as any).toDate();

      let matchesDate = true;
      if (appliedStartDate) matchesDate = matchesDate && eventDate >= new Date(appliedStartDate);
      if (appliedEndDate) matchesDate = matchesDate && eventDate <= new Date(`${appliedEndDate}T23:59:59`);

      return matchesType && matchesDate;
    });
  }, [events, appliedEndDate, appliedFilterType, appliedStartDate]);

  const isAdmin = currentUser?.role === 'admin' || auth.currentUser?.email === 'rakshith.e07@gmail.com';

  const getAttendeeCount = (eventId: string) => attendeeCounts[eventId] || 0;

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await deleteDoc(doc(db, 'events', eventToDelete.id));
      setEventToDelete(null);
      setFeedback({
        type: 'success',
        title: 'Assembly removed',
        message: 'The event has been removed from the schedule.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${eventToDelete.id}`);
      setFeedback({
        type: 'error',
        title: 'Unable to remove event',
        message: 'Please try again. The event could not be deleted.',
      });
    }
  };

  const reserveEvent = async (event: Event) => {
    if (!currentUser) return;

    setRsvpLoading(true);
    try {
      const attendeeRef = doc(db, 'events', event.id, 'attendees', currentUser.userId);
      const scheduleRef = doc(db, 'users', currentUser.userId, 'calendarEvents', event.id);

      await setDoc(attendeeRef, {
        eventId: event.id,
        userId: currentUser.userId,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL || '',
        registeredAt: serverTimestamp(),
      });

      await setDoc(scheduleRef, {
        eventId: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        locationLink: event.locationLink || '',
        type: event.type,
        startAt: event.date,
        reminderStatus: 'scheduled',
        reminderLeadMinutes: 60,
        syncedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setEventToRSVP(null);
      setReservationReviewEvent(event);
      setFeedback({
        type: 'success',
        title: 'Reservation confirmed',
        message: 'Your reservation has been successfully confirmed. The event has been added to your schedule.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `events/${event.id}/attendees`);
      setFeedback({
        type: 'error',
        title: 'Reservation failed',
        message: 'We could not confirm your reservation. Please try again.',
      });
    } finally {
      setRsvpLoading(false);
    }
  };

  const cancelReservation = async (event: Event) => {
    if (!currentUser) return;
    setCancellingReservation(true);

    try {
      await deleteDoc(doc(db, 'events', event.id, 'attendees', currentUser.userId));
      await deleteDoc(doc(db, 'users', currentUser.userId, 'calendarEvents', event.id));
      setReservationReviewEvent(null);
      setEventToRSVP(null);
      setSelectedEvent(null);
      setFeedback({
        type: 'info',
        title: 'Reservation cancelled',
        message: 'Your reservation and schedule entry were removed successfully.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${event.id}/attendees/${currentUser.userId}`);
      setFeedback({
        type: 'error',
        title: 'Cancellation failed',
        message: 'We could not cancel this reservation. Please check your connection and try again.',
      });
    } finally {
      setCancellingReservation(false);
    }
  };

  return (
    <div className="space-y-8 pb-24 sm:space-y-10 md:space-y-12">
      {feedback && (
        <FeedbackBanner
          feedback={feedback}
          onClose={() => setFeedback(null)}
        />
      )}

      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="mb-2 text-3xl font-serif leading-tight gold-text sm:text-4xl lg:text-5xl">Society Assemblies</h1>
          <p className="max-w-2xl text-sm italic leading-7 text-platinum/45 sm:text-base">
            Curated experiences for the discerning few, with live reservation tracking and private scheduling.
          </p>
        </div>

        <div className="relative w-full lg:w-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-widest text-platinum/60 transition-all hover:bg-white/10 lg:w-auto"
          >
            <Filter className="h-4 w-4" />
            Filters
            {isFilterOpen ? <X className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="absolute right-0 top-full z-50 mt-4 w-full rounded-3xl border border-white/10 bg-[#111] p-5 shadow-2xl backdrop-blur-2xl sm:w-[360px]"
              >
                <div className="space-y-5">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gold/60">Assembly Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" />
                      <FilterButton active={filterType === 'virtual'} onClick={() => setFilterType('virtual')} icon={<Globe className="h-3 w-3" />} label="Digital" />
                      <FilterButton active={filterType === 'in-person'} onClick={() => setFilterType('in-person')} icon={<MapIcon className="h-3 w-3" />} label="Physical" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gold/60">Date Window</label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <InputField label="From" type="date" value={startDate} onChange={setStartDate} />
                      <InputField label="To" type="date" value={endDate} onChange={setEndDate} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => {
                        setFilterType('all');
                        setStartDate('');
                        setEndDate('');
                        setAppliedFilterType('all');
                        setAppliedStartDate('');
                        setAppliedEndDate('');
                      }}
                      className="flex-1 rounded-xl border border-white/5 py-3 text-[10px] font-bold uppercase tracking-widest text-platinum/30 transition-colors hover:bg-white/5 hover:text-red-400"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => {
                        setAppliedFilterType(filterType);
                        setAppliedStartDate(startDate);
                        setAppliedEndDate(endDate);
                        setIsFilterOpen(false);
                      }}
                      className="flex-1 rounded-xl bg-gold py-3 text-[10px] font-bold uppercase tracking-widest text-onyx shadow-lg shadow-gold/20 transition-colors hover:bg-gold/90"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="min-h-[320px] animate-pulse rounded-3xl border border-white/5 bg-white/5" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-white/5 py-16 text-center sm:py-20">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-white/5" />
          <p className="px-4 text-2xl font-serif italic text-platinum/20">No events match your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              attendeeCount={getAttendeeCount(event.id)}
              isAdmin={isAdmin}
              isRegistered={userRegistrations.has(event.id)}
              onClick={() => setSelectedEvent(event)}
              onDelete={() => setEventToDelete({ id: event.id, title: event.title })}
              onRSVP={() => setEventToRSVP(event)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {eventToRSVP && (
          <CenteredModal onClose={() => !rsvpLoading && setEventToRSVP(null)}>
            <div className="space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                <Ticket className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-2xl font-serif text-white sm:text-3xl">Confirm your reservation</h3>
                <p className="mt-3 text-sm leading-7 text-platinum/45">
                  Reserve your place for <span className="text-gold">{eventToRSVP.title}</span>. Your booking will be saved instantly and added to your schedule in the background.
                </p>
              </div>
              <EventFacts event={eventToRSVP} attendeeCount={getAttendeeCount(eventToRSVP.id)} />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  disabled={rsvpLoading}
                  onClick={() => setEventToRSVP(null)}
                  className="flex-1 rounded-xl border border-white/10 py-4 text-xs font-bold uppercase tracking-widest text-platinum/40 transition-all hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={rsvpLoading}
                  onClick={() => reserveEvent(eventToRSVP)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold py-4 text-xs font-bold uppercase tracking-widest text-onyx shadow-xl shadow-gold/20 transition-all hover:scale-[1.01] disabled:opacity-50"
                >
                  {rsvpLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-onyx/20 border-t-onyx" /> : 'Confirm Reservation'}
                </button>
              </div>
            </div>
          </CenteredModal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reservationReviewEvent && (
          <CenteredModal onClose={() => !cancellingReservation && setReservationReviewEvent(null)}>
            <div className="space-y-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gold/10 text-gold">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-2xl font-serif text-white sm:text-3xl">Reservation confirmed</h3>
                <p className="mt-3 text-sm leading-7 text-platinum/50">
                  Your reservation has been successfully confirmed. The event has been added to your schedule.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-gold/15 bg-white/5 p-5">
                <h4 className="text-lg font-serif text-white">{reservationReviewEvent.title}</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DetailPill label="Date" value={formatDate(reservationReviewEvent.date)} />
                  <DetailPill label="Time" value={formatTime(reservationReviewEvent.date)} />
                  <DetailPill label="Location" value={reservationReviewEvent.location} className="sm:col-span-2" />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setReservationReviewEvent(null)}
                  className="flex-1 rounded-xl bg-gold py-4 text-xs font-bold uppercase tracking-widest text-onyx shadow-xl shadow-gold/20 transition-all hover:scale-[1.01]"
                >
                  Done
                </button>
                <button
                  disabled={cancellingReservation}
                  onClick={() => cancelReservation(reservationReviewEvent)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 py-4 text-xs font-bold uppercase tracking-widest text-red-100 transition-all hover:bg-red-500/15 disabled:opacity-50"
                >
                  {cancellingReservation ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-100/20 border-t-red-100" /> : 'Cancel Reservation'}
                </button>
              </div>
            </div>
          </CenteredModal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEvent && (
          <CenteredModal onClose={() => setSelectedEvent(null)} maxWidth="max-w-3xl">
            <div className="flex max-h-[85vh] flex-col overflow-hidden">
              <div className="relative h-52 w-full flex-shrink-0 overflow-hidden rounded-[1.75rem] sm:h-64">
                <img src={selectedEvent.imageUrl} alt={selectedEvent.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/10 to-transparent" />
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="absolute right-4 top-4 rounded-full bg-black/40 p-2 backdrop-blur-md transition-colors hover:bg-black/60"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
                <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                  {selectedEvent.type === 'virtual' ? <span className="text-blue-400">Digital Realm</span> : <span className="text-gold">Physical Domain</span>}
                </div>
              </div>

              <div className="custom-scrollbar-minimal overflow-y-auto px-1">
                <div className="space-y-6 p-4 sm:p-6 md:p-8">
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-gold">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDateTime(selectedEvent.date)}</span>
                  </div>
                  <h2 className="text-3xl font-serif leading-tight text-white sm:text-4xl">{selectedEvent.title}</h2>
                  <EventFacts event={selectedEvent} attendeeCount={getAttendeeCount(selectedEvent.id)} />
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-platinum/40">Assembly Briefing</h4>
                    <p className="whitespace-pre-wrap break-words text-sm font-light leading-7 text-platinum/80 sm:text-base">
                      {selectedEvent.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:justify-end sm:p-6">
                {userRegistrations.has(selectedEvent.id) ? (
                  <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/20 bg-gold/10 px-6 py-3 text-xs font-black uppercase tracking-widest text-gold">
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmed
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedEvent(null);
                      setEventToRSVP(selectedEvent);
                    }}
                    className="rounded-xl bg-gold px-8 py-3 text-xs font-bold uppercase tracking-widest text-onyx shadow-xl shadow-gold/20 transition-all hover:bg-gold/90"
                  >
                    Reserve Event
                  </button>
                )}
              </div>
            </div>
          </CenteredModal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {eventToDelete && (
          <CenteredModal onClose={() => setEventToDelete(null)}>
            <div className="space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-2xl font-serif text-white">Remove this event?</h3>
                <p className="mt-3 text-sm italic leading-7 text-platinum/40">
                  Are you certain you wish to dissolve the assembly <span className="text-gold">"{eventToDelete.title}"</span>? This will remove it from the live schedule.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setEventToDelete(null)}
                  className="flex-1 rounded-xl border border-white/10 py-4 text-xs font-bold uppercase tracking-widest text-platinum/40 transition-all hover:bg-white/5"
                >
                  Retain
                </button>
                <button
                  onClick={handleDeleteEvent}
                  className="flex-1 rounded-xl bg-red-600 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-xl shadow-red-600/20 transition-all hover:bg-red-700"
                >
                  Dissolve
                </button>
              </div>
            </div>
          </CenteredModal>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-[9px] font-bold uppercase text-platinum/30">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] focus:outline-none focus:border-gold/30"
      />
    </div>
  );
}

function FilterButton({ active, label, icon, onClick }: { active: boolean; label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border p-3 transition-all',
        active ? 'border-gold/30 bg-gold/10 text-gold shadow-lg shadow-gold/10' : 'border-white/10 bg-white/5 text-platinum/30 hover:bg-white/10'
      )}
    >
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function EventCard({
  event,
  attendeeCount,
  isAdmin,
  isRegistered,
  onClick,
  onDelete,
  onRSVP,
}: {
  event: Event;
  attendeeCount: number;
  isAdmin: boolean;
  isRegistered: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRSVP: () => void;
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      className="group relative flex h-full min-h-[320px] cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/5 bg-[#1A1A1A] shadow-2xl transition-all hover:border-gold/20 lg:min-h-[340px] xl:flex-row"
    >
      <div className="relative min-h-[220px] w-full overflow-hidden xl:min-h-full xl:w-[42%]">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="h-full w-full object-cover opacity-60 grayscale transition-all duration-700 group-hover:opacity-100 group-hover:grayscale-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-onyx/90 via-onyx/20 to-transparent xl:bg-gradient-to-r" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
          {event.type === 'virtual' ? <span className="text-blue-400">Digital Realm</span> : <span className="text-gold">Physical Domain</span>}
        </div>

        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute bottom-4 left-4 translate-y-2 rounded-xl border border-red-600/30 bg-red-600/10 p-3 text-red-600 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between space-y-6 p-5 sm:p-6 md:p-8">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-gold">
            <Calendar className="h-3 w-3" />
            <span>{formatDateTime(event.date)}</span>
          </div>
          <h3 className="mb-4 break-words text-2xl font-serif leading-tight transition-colors group-hover:text-gold sm:text-3xl">{event.title}</h3>
          <p className="line-clamp-4 break-words text-sm font-light italic leading-7 text-platinum/40">
            {event.description}
          </p>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/5 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 items-start gap-2 text-xs text-platinum/60">
              <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold/60" />
              <span className="break-words leading-6">{event.location}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-platinum/40">
              <Users className="h-3 w-3" />
              <span>{attendeeCount} attending</span>
            </div>
          </div>

          {isRegistered ? (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/20 bg-gold/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gold">
              <CheckCircle2 className="h-3 w-3" />
              Confirmed
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRSVP();
              }}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-platinum transition-all hover:border-gold/20 hover:bg-gold hover:text-onyx"
            >
              Reserve
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EventFacts({ event, attendeeCount }: { event: Event; attendeeCount: number }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
      <DetailPill label="Date" value={formatDate(event.date)} />
      <DetailPill label="Time" value={formatTime(event.date)} />
      <DetailPill label="Location" value={event.location} className="sm:col-span-2" />
      <DetailPill label="Attendees" value={`${attendeeCount} confirmed`} />
      <DetailPill label="Format" value={event.type === 'virtual' ? 'Virtual event' : 'In-person event'} />
    </div>
  );
}

function DetailPill({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-white/8 bg-black/20 p-3', className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-platinum/35">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-platinum/90">{value}</p>
    </div>
  );
}

function CenteredModal({
  children,
  onClose,
  maxWidth = 'max-w-md',
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 18 }}
        className={cn('relative w-full rounded-3xl border border-white/10 bg-[#1A1A1A] p-6 shadow-2xl sm:p-8', maxWidth)}
      >
        {children}
      </motion.div>
    </div>
  );
}

function FeedbackBanner({
  feedback,
  onClose,
}: {
  feedback: Exclude<ReservationFeedback, null>;
  onClose: () => void;
}) {
  const toneClass =
    feedback.type === 'success'
      ? 'border-emerald-300/18 bg-emerald-300/8 text-emerald-100'
      : feedback.type === 'error'
        ? 'border-rose-300/18 bg-rose-300/8 text-rose-100'
        : 'border-gold/20 bg-gold/8 text-gold';

  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between', toneClass)}>
      <div>
        <p className="text-sm font-semibold">{feedback.title}</p>
        <p className="mt-1 text-sm leading-6 opacity-90">{feedback.message}</p>
      </div>
      <button onClick={onClose} className="self-start text-xs font-semibold uppercase tracking-widest opacity-80 transition hover:opacity-100">
        Dismiss
      </button>
    </div>
  );
}
