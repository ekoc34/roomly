export type ListingType = "room_for_rent" | "roommate_search" | "short_stay";

export type ApplicationStatus = "pending" | "accepted" | "rejected";

export type UserRole = "student" | "landlord" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  role: UserRole;
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

export type ListingMonetization = {
  listing_id: string;
  featured_until: string | null;
  subscription_id: string | null;
  boost_expires_at: string | null;
  created_at: string;
};
