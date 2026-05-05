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
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: string;
  listing_id: string;
  user_id: string;
  message: string;
  budget: number | null;
  availability_text: string;
  status: ApplicationStatus;
  created_at: string;
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
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type ReportCategory =
  | "scam"
  | "spam"
  | "inappropriate"
  | "fake_photos"
  | "duplicate"
  | "other";

export type ListingReport = {
  id: string;
  listing_id: string;
  reporter_id: string;
  reason: string;
  category: ReportCategory;
  created_at: string;
};

export type ListingMonetization = {
  listing_id: string;
  featured_until: string | null;
  subscription_id: string | null;
  boost_expires_at: string | null;
  created_at: string;
};
