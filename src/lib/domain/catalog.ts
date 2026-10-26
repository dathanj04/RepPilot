export const INTERACTION_TYPES = [
  { id: "office_visit", label: "Office Visit" },
  { id: "educational_lunch", label: "Educational Lunch" },
  { id: "coffee_breakfast", label: "Coffee / Breakfast" },
  { id: "phone_call", label: "Phone Call" },
  { id: "virtual_meeting", label: "Virtual Meeting" },
  { id: "drop_off", label: "Drop Off" },
  { id: "follow_up", label: "Follow-Up" },
  { id: "event", label: "Event" },
  { id: "note", label: "Note" },
  { id: "other", label: "Other" },
] as const;

export const INTERACTION_TYPE_IDS = INTERACTION_TYPES.map((item) => item.id);

export const OUTCOMES = [
  { id: "completed", label: "Completed" },
  { id: "scheduled", label: "Scheduled" },
  { id: "rescheduled", label: "Rescheduled" },
  { id: "no_show", label: "No Show" },
  { id: "canceled", label: "Canceled" },
] as const;

export const CONTACT_ROLES = [
  { id: "physician", label: "Physician" },
  { id: "office_manager", label: "Office Manager" },
  { id: "front_desk", label: "Front Desk" },
  { id: "medical_assistant", label: "Medical Assistant" },
  { id: "referral_coordinator", label: "Referral Coordinator" },
  { id: "practice_administrator", label: "Practice Administrator" },
  { id: "other", label: "Other" },
] as const;

export const ACTIVITIES = [
  { id: "introduced_services", label: "Introduced services" },
  { id: "provided_program_overview", label: "Provided program overview" },
  { id: "left_educational_materials", label: "Left educational materials" },
  { id: "discussed_referral_process", label: "Discussed referral process" },
  { id: "answered_questions", label: "Answered questions" },
  { id: "met_office_manager", label: "Met office manager" },
  { id: "scheduled_lunch", label: "Scheduled lunch" },
  { id: "completed_educational_lunch", label: "Completed educational lunch" },
  { id: "sent_resources", label: "Sent resources" },
  { id: "no_contact_available", label: "No contact available" },
  { id: "other", label: "Other" },
] as const;

export const NEXT_STEPS = [
  { id: "follow_up", label: "Follow up with office", needsDate: true },
  { id: "send_materials", label: "Send educational materials", needsDate: true },
  { id: "schedule_lunch", label: "Schedule a lunch", needsDate: true },
  { id: "send_email", label: "Send an email", needsDate: true },
  { id: "phone_call", label: "Make a phone call", needsDate: true },
  { id: "schedule_visit", label: "Schedule another visit", needsDate: true },
  { id: "custom", label: "Custom task", needsDate: true },
  { id: "none", label: "No follow-up needed", needsDate: false },
] as const;

export const PHYSICAL_VISIT_TYPES = new Set([
  "office_visit",
  "educational_lunch",
  "coffee_breakfast",
  "drop_off",
  "event",
]);

export const MARKER_TONES = [
  { id: "recent", label: "Visited recently", color: "#19B78A" },
  { id: "follow_up", label: "Follow-up due", color: "#F3B544" },
  { id: "overdue", label: "Overdue or high priority", color: "#D94B4B" },
  { id: "steady", label: "Visited, no action due", color: "#10263E" },
  { id: "never", label: "Not yet visited", color: "#94A3B8" },
] as const;

export type MarkerTone = (typeof MARKER_TONES)[number]["id"];

export const CATERING_ORDER_NOTE = "Ordering opens the provider’s website in a new tab. RepPilot does not place or pay for the order automatically.";
export const CATERING_LATER_NOTE = "You can schedule the lunch first and record order details later from the lunch details page.";

export const CATERING_PROVIDERS = [
  {
    id: "ezcater",
    label: "Order with ezCater",
    url: "https://www.ezcater.com/",
    live: true,
  },
  {
    id: "doordash",
    label: "Order with DoorDash",
    url: "https://www.doordash.com/",
    live: true,
  },
  {
    id: "uber_eats",
    label: "Uber Eats",
    url: "https://www.ubereats.com/",
    live: false,
  },
] as const;

export const ORDER_STATUSES = [
  "NOT_STARTED",
  "ORDERING_EXTERNALLY",
  "ORDER_RECORDED",
  "CANCELED",
  "COMPLETED",
] as const;

export function labelFor(
  list: readonly { id: string; label: string }[],
  id: string,
) {
  return list.find((item) => item.id === id)?.label ?? id;
}
