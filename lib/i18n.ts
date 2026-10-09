// TDPCS-Apt Internationalization Strings Dictionary
// Structured to facilitate adding Malayalam (ml) or other regional languages seamlessly.

export const defaultLocale = 'en';

export const dictionary = {
  en: {
    app: {
      name: 'TDPCS-Apt',
      bankName: 'Thrissur District Police Co-operative Society',
      shortBankName: 'TDPCS',
      tagline: 'Automated Pre-Token Counter Slot Booking',
    },
    customer: {
      step: 'Step',
      of: 'of',
      next: 'Continue',
      back: 'Back',
      confirmBooking: 'Confirm Booking',
      loading: 'Please wait...',
      expiredTitle: 'Link Expired',
      expiredMessage:
        'This booking link has expired. Please send a message to the TDPCS WhatsApp number to receive a fresh secure link.',
      invalidLink: 'Invalid or missing booking link.',
      
      // Screen 1: Details
      detailsTitle: 'Your Information',
      detailsSubtitle: 'Confirm your name for your appointment token',
      fullNameLabel: 'Full Name',
      fullNamePlaceholder: 'Enter your full name',
      nameMinChars: 'Please enter at least 2 characters',
      whatsappNumberLabel: 'Your WhatsApp Number',
      whatsappVerifiedHint: 'Verified from your WhatsApp chat',

      // Screen 2: Date
      dateTitle: 'Select Visit Date',
      dateSubtitle: 'Choose from open booking dates (up to 15 days in advance)',
      noDatesAvailable: 'Booking is not open yet. Please check again later.',
      session1: 'Morning Session',
      session2: 'Afternoon Session',

      // Screen 3: Services
      servicesTitle: 'Select Services',
      servicesSubtitle: 'Select one or more services needed during your visit',
      noServicesAvailable: 'No services currently configured.',
      totalDuration: 'Total Time',
      minutes: 'min',
      selectAtLeastOne: 'Please select at least one service to proceed.',

      // Screen 4: Time
      timeTitle: 'Choose Slot Time',
      timeSubtitle: 'Available counter start times based on your selected services',
      morningSlots: 'Morning Slots',
      afternoonSlots: 'Afternoon Slots',
      refreshSlots: 'Refresh Available Times',
      noSlotsAvailable: 'No times available on this date. Please choose another date.',

      // Screen 5: Review
      reviewTitle: 'Review Appointment',
      reviewSubtitle: 'Please review and confirm your slot details',
      reportingNotice: 'Important: Please report at least 10 minutes before your slot',
      reportBy: 'Report by',
      slotTime: 'Slot Time',
      selectedServices: 'Selected Services',
      totalEstimatedTime: 'Total Duration',
      confirmAndBook: 'Confirm & Generate Token',
      bookingInProgress: 'Reserving Slot...',

      // Screen 6: Success
      bookingConfirmed: 'Slot Booked Successfully!',
      tokenNumber: 'Token Number',
      counter: 'Assigned Counter',
      whatsappSentNotice:
        'A confirmation message with your token and reporting details has been sent to your WhatsApp.',
      strictArrivalWarning:
        'Arriving after your slot start time automatically cancels the booking; you may then take a manual paper token at Counter 3/Manual Desk.',
      viewMyBookings: 'View My Bookings',
      bookAnotherSlot: 'Book Another Slot',

      // Errors
      slotTaken: 'That time was just taken. Please choose another available slot.',
      alreadyBooked:
        'You already have an active booking on this date. Only one active booking is permitted per day.',
      dayClosed: 'The selected date is no longer open for booking.',
      noProducts: 'Please select at least one active service.',
      nameRequired: 'Your full name is required (minimum 2 characters).',

      // My bookings
      myBookingsTitle: 'My Bookings',
      myBookingsSubtitle: 'Your upcoming counter reservations',
      noBookings: 'You have no upcoming bookings.',
      cancelBooking: 'Cancel Booking',
      changeBooking: 'Change Slot',
      cancelConfirmTitle: 'Cancel This Booking?',
      cancelConfirmDesc:
        'Are you sure you want to cancel token {token}? Your slot will be released immediately for other society members.',
      cancelSuccess: 'Booking cancelled successfully.',
      rescheduleSuccess: 'Your slot has been changed successfully. New token: {token}',
      rescheduleError:
        'That slot is no longer available. Your original booking remains unchanged.',
      keepBooking: 'No, Keep Slot',
      confirmCancel: 'Yes, Cancel Slot',
      changeDateTitle: 'Select New Date',
      changeTimeTitle: 'Select New Slot Time',
      reviewChangeTitle: 'Confirm Slot Change',
      oldSlot: 'Current Slot',
      newSlot: 'New Slot',
      confirmReschedule: 'Confirm Change',
    },
    staff: {
      dashboard: 'Live Queue Monitor',
      queue: 'Queue Desk',
      bookings: 'All Bookings',
      calendar: 'Calendar & Hours',
      products: 'Loan & Service Master',
      settings: 'Branch Settings',
      users: 'Staff & Admin Accounts',
      reports: 'Reports & Analytics',
      audit: 'Audit Log',
      logout: 'Sign Out',
      counter1: 'Counter 1',
      counter2: 'Counter 2',
      actions: {
        arrived: 'Mark Arrived',
        call: 'Call Token',
        served: 'Mark Served',
        cancel: 'Cancel',
        noShow: 'Mark No-show',
        extend: 'Extend Time',
        callNext: 'Call Next Token',
        blockDay: 'Block This Date (Holiday)',
      },
    },
  },
};

export type Locale = keyof typeof dictionary;
export type Dictionary = (typeof dictionary)[typeof defaultLocale];

export function getStrings(locale: Locale = defaultLocale): Dictionary {
  return dictionary[locale] || dictionary[defaultLocale];
}
