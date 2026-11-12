import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ChatProvider } from "@/contexts/ChatContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import PageLoader from "@/components/PageLoader";
import PublicLayout from "@/components/layout/PublicLayout";
import ChatWidget from "@/components/chat/ChatWidget";
import Index from "./pages/Index";

// Pages are loaded on demand so each visitor only downloads what they open
const DashboardLayout = lazy(() => import("@/components/layout/DashboardLayout"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UserDashboard = lazy(() => import("./pages/user/Dashboard"));
const StationFinder = lazy(() => import("./pages/StationFinder"));
const UserBookings = lazy(() => import("./pages/user/Bookings"));
const Payment = lazy(() => import("./pages/user/Payment"));
const Profile = lazy(() => import("./pages/Profile"));
const ProviderDashboard = lazy(() => import("./pages/provider/Dashboard"));
const Chargers = lazy(() => import("./pages/provider/Chargers"));
const ProviderBookings = lazy(() => import("./pages/provider/Bookings"));
const Earnings = lazy(() => import("./pages/provider/Earnings"));
const ProviderAnalytics = lazy(() => import("./pages/provider/Analytics"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const Accounts = lazy(() => import("./pages/admin/Accounts"));
const Stations = lazy(() => import("./pages/admin/Stations"));
const Transactions = lazy(() => import("./pages/admin/Transactions"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const Settings = lazy(() => import("./pages/admin/Settings"));

const App = () => (
  <ThemeProvider>
    <ChatProvider>
      <Toaster richColors closeButton mobileOffset={{ bottom: 96 }} />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/stations" element={<StationFinder publicPage />} />
            </Route>
            <Route path="/auth" element={<Auth />} />
            <Route path="/user" element={<DashboardLayout role="user" />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<UserDashboard />} />
              <Route path="map" element={<StationFinder />} />
              <Route path="bookings" element={<UserBookings />} />
              <Route path="payment" element={<Payment />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="/provider" element={<DashboardLayout role="provider" />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ProviderDashboard />} />
              <Route path="chargers" element={<Chargers />} />
              <Route path="bookings" element={<ProviderBookings />} />
              <Route path="earnings" element={<Earnings />} />
              <Route path="analytics" element={<ProviderAnalytics />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="/admin" element={<DashboardLayout role="admin" />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<Accounts key="user" role="user" />} />
              <Route path="providers" element={<Accounts key="provider" role="provider" />} />
              <Route path="stations" element={<Stations />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="admins" element={<Accounts key="admin" role="admin" />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <ChatWidget />
      </BrowserRouter>
    </ChatProvider>
  </ThemeProvider>
);

export default App;
