export type ListingType = "room_for_rent" | "roommate_search" | "short_stay";

export type ApplicationStatus = "pending" | "accepted" | "rejected";

export type UserRole = "student" | "landlord" | "admin";

export type UserType =
  | "tenant"
  | "landlord"
  | "student"
  | "professional"
  | "family";

export type Profile = {
  id: string;
  email: string | null;
  role: UserRole;
  user_type: UserType;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  phone_verified: boolean;
  email_auto_verified: boolean;
  student_verified: boolean;
  student_verification_requested_at: string | null;
  verification_badge: string | null;
  show_email: boolean;
  show_phone: boolean;
  notify_new_message?: boolean | null;
  notify_application_update?: boolean | null;
  notify_matching_listing?: boolean | null;
  scam_flagged?: boolean;
  last_active_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  type: ListingType;
  images: string[];
  availability_date: string | null;
  rooms: number | null;
  surface_area: number | null;
  pets_allowed: boolean | null;
  smoking_allowed: boolean | null;
  gender_preference: "vrouw" | "man" | "gemengd" | null;
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: string;
  listing_id: string;
  applicant_id: string;
  message: string;
  budget: number | null;
  status: ApplicationStatus;
  contact_revealed: boolean;
  created_at: string;
};

export type ApplicationWithDetails = Application & {
  profiles: { name: string | null; email: string | null; avatar_url: string | null } | null;
  listings: { title: string } | null;
};

export type Favorite = {
  user_id: string;
  listing_id: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  listing_id: string;
  tenant_id: string;
  landlord_id: string;
  last_message_at: string;
  created_at: string;
  hidden_by: string[];
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationType =
  | "new_application"
  | "application_accepted"
  | "application_rejected"
  | "new_message"
  | "new_matching_listing"
  | "badge_revoked";

export type SavedSearch = {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, string>;
  notify: boolean;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_id: string | null;
  read: boolean;
  created_at: string;
};

export type ListingView = {
  id: string;
  user_id: string;
  listing_id: string;
  viewed_at: string;
};

export type ReportCategory =
  | "scam"
  | "spam"
  | "inappropriate"
  | "fake_photos"
  | "duplicate"
  | "other";
