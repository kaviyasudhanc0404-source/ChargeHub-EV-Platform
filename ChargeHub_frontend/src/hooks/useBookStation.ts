import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import type { Station } from "@/lib/stations";

// "Book slot" on a station card: guests sign in first, only driver accounts book; returns the station for BookingDialog
export const useBookStation = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [bookingStation, setBookingStation] = useState<Station | null>(null);

  const book = (station: Station) => {
    if (!user) {
      toast.info("Sign in to book this charger");
      navigate("/auth", { state: { from: `/stations?book=${station._id}` } });
      return;
    }
    if (user.role !== "user") {
      toast.error("Bookings are made from a driver account");
      return;
    }
    setBookingStation(station);
  };

  return { bookingStation, book, closeBooking: () => setBookingStation(null) };
};
