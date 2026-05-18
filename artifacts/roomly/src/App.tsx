import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { Toaster } from "sonner";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { CompareBar } from "@/components/listings/CompareBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { SelectedCityProvider } from "@/contexts/SelectedCityContext";
import { CompareProvider } from "@/contexts/CompareContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useLastActive } from "@/hooks/useLastActive";
import { useAuth } from "@/hooks/useAuth";
import { EmailVerificationHandler } from "@/components/EmailVerificationHandler";
import { OAuthProfileHandler } from "@/components/OAuthProfileHandler";
import { EmailVerificationGate } from "@/components/EmailVerificationGate";
import { PasswordRecoveryHandler } from "@/components/PasswordRecoveryHandler";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { PlausibleProvider } from "@/components/PlausibleProvider";

import { HomePage } from "@/pages/HomePage";
import { ListingsPage } from "@/pages/ListingsPage";
import { NewListingPage } from "@/pages/NewListingPage";
import { EditListingPage } from "@/pages/EditListingPage";
import { FavoritesPage } from "@/pages/FavoritesPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { ConversationPage } from "@/pages/ConversationPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { WelcomePage } from "@/pages/WelcomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { EmailVerifiedPage } from "@/pages/EmailVerifiedPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { OnboardingPage } from "@/pages/OnboardingPage";

const ListingDetailPage = lazy(() => import("@/pages/ListingDetailPage").then((m) => ({ default: m.ListingDetailPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const MapPage = lazy(() => import("@/pages/MapPage").then((m) => ({ default: m.MapPage })));
const SavedSearchesPage = lazy(() => import("@/pages/SavedSearchesPage").then((m) => ({ default: m.SavedSearchesPage })));
const ComparePage = lazy(() => import("@/pages/ComparePage").then((m) => ({ default: m.ComparePage })));
const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const AdminAnalyticsPage = lazy(() => import("@/pages/AdminAnalyticsPage").then((m) => ({ default: m.AdminAnalyticsPage })));
const ContactPage = lazy(() => import("@/pages/ContactPage").then((m) => ({ default: m.ContactPage })));
const PricingPage = lazy(() => import("@/pages/PricingPage").then((m) => ({ default: m.PricingPage })));
const PaymentSuccessPage = lazy(() => import("@/pages/PaymentSuccessPage").then((m) => ({ default: m.PaymentSuccessPage })));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const VoorwaardenPage = lazy(() => import("@/pages/VoorwaardenPage").then((m) => ({ default: m.VoorwaardenPage })));
const CookiesPage = lazy(() => import("@/pages/CookiesPage").then((m) => ({ default: m.CookiesPage })));
const CookieVoorkeurenPage = lazy(() => import("@/pages/CookieVoorkeurenPage").then((m) => ({ default: m.CookieVoorkeurenPage })));
const VerificationPage = lazy(() => import("@/pages/VerificationPage").then((m) => ({ default: m.VerificationPage })));

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
    </div>
  );
}

function NotFound() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-6xl font-black text-stone-200">404</p>
        <h1 className="mt-4 text-xl font-semibold text-stone-900">Pagina niet gevonden</h1>
        <p className="mt-2 text-sm text-stone-500">De pagina die je zoekt bestaat niet.</p>
        <a href="/" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]">Terug naar home</a>
      </div>
    </PageTransition>
  );
}

function AnimatedRoute({ component: Component }: { component: React.ComponentType }) {
  const [path] = useLocation();
  const keyRef = useRef(path);
  useEffect(() => { keyRef.current = path; }, [path]);
  return (
    <PageTransition key={path}>
      <ErrorBoundary resetKeys={[path]}>
        <Suspense fallback={<PageLoader />}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    </PageTransition>
  );
}

function ActivityTracker() {
  useLastActive();
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <AnimatedRoute component={HomePage} />} />
      <Route path="/kamers" component={() => <AnimatedRoute component={ListingsPage} />} />
      <Route path="/kamers/nieuw" component={() => <AnimatedRoute component={NewListingPage} />} />
      <Route path="/kamers/:id/bewerken" component={() => <AnimatedRoute component={EditListingPage} />} />
      <Route path="/kamers/:id" component={() => <AnimatedRoute component={ListingDetailPage} />} />
      <Route path="/kaart" component={() => <AnimatedRoute component={MapPage} />} />
      <Route path="/favorieten" component={() => <AnimatedRoute component={FavoritesPage} />} />
      <Route path="/berichten" component={() => <AnimatedRoute component={MessagesPage} />} />
      <Route path="/berichten/:id" component={() => <AnimatedRoute component={ConversationPage} />} />
      <Route path="/notificaties" component={() => <AnimatedRoute component={NotificationsPage} />} />
      <Route path="/dashboard" component={() => <AnimatedRoute component={DashboardPage} />} />
      <Route path="/vergelijk" component={() => <AnimatedRoute component={ComparePage} />} />
      <Route path="/opgeslagen-zoekopdrachten" component={() => <AnimatedRoute component={SavedSearchesPage} />} />
      <Route path="/profiel" component={() => <AnimatedRoute component={ProfilePage} />} />
      <Route path="/welkom" component={() => <AnimatedRoute component={WelcomePage} />} />
      <Route path="/inloggen" component={() => <AnimatedRoute component={LoginPage} />} />
      <Route path="/registreren" component={() => <AnimatedRoute component={RegisterPage} />} />
      <Route path="/wachtwoord-vergeten" component={() => <AnimatedRoute component={ForgotPasswordPage} />} />
      <Route path="/wachtwoord-instellen" component={() => <AnimatedRoute component={ResetPasswordPage} />} />
      <Route path="/admin/dashboard" component={() => <AnimatedRoute component={AdminDashboardPage} />} />
      <Route path="/admin/analytics" component={() => <AnimatedRoute component={AdminAnalyticsPage} />} />
      <Route path="/contact" component={() => <AnimatedRoute component={ContactPage} />} />
      <Route path="/email-verificatie" component={() => <AnimatedRoute component={EmailVerifiedPage} />} />
      <Route path="/auth/callback" component={() => <AnimatedRoute component={AuthCallbackPage} />} />
      <Route path="/onboarding" component={() => <AnimatedRoute component={OnboardingPage} />} />
      <Route path="/pricing" component={() => <AnimatedRoute component={PricingPage} />} />
      <Route path="/betaling-succesvol" component={() => <AnimatedRoute component={PaymentSuccessPage} />} />
      <Route path="/privacy" component={() => <AnimatedRoute component={PrivacyPage} />} />
      <Route path="/voorwaarden" component={() => <AnimatedRoute component={VoorwaardenPage} />} />
      <Route path="/cookies" component={() => <AnimatedRoute component={CookiesPage} />} />
      <Route path="/cookievoorkeuren" component={() => <AnimatedRoute component={CookieVoorkeurenPage} />} />
      <Route path="/verificatie" component={() => <AnimatedRoute component={VerificationPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [path] = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
      </div>
    );
  }

  // Skip the email verification gate during password recovery so the reset
  // form is never blocked by an unconfirmed-email wall.
  if (user && !user.email_confirmed_at && path !== "/wachtwoord-instellen") {
    return <EmailVerificationGate user={user} />;
  }

  return (
    <>
      <ErrorBoundary fallback={null}><ActivityTracker /></ErrorBoundary>
      <ErrorBoundary fallback={null}><EmailVerificationHandler /></ErrorBoundary>
      <ErrorBoundary fallback={null}><OAuthProfileHandler /></ErrorBoundary>
      <ErrorBoundary fallback={null}><PasswordRecoveryHandler /></ErrorBoundary>
      <ErrorBoundary fallback={<div className="h-16 border-b border-stone-200 bg-white" />}>
        <Header />
      </ErrorBoundary>
      <main className="flex-1">
        <Router />
      </main>
      <ErrorBoundary fallback={null}>
        <Footer />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <MobileBottomNav />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <CompareBar />
      </ErrorBoundary>
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
    <SelectedCityProvider>
      <CompareProvider>
        <div className="flex min-h-screen flex-col bg-stone-50">
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
            <PlausibleProvider />
          </WouterRouter>
          <Toaster position="bottom-right" richColors closeButton toastOptions={{ classNames: { closeButton: "!left-auto !right-0 !translate-x-1/2 !-translate-y-1/2" } }} />
        </div>
        <CookieConsentBanner />
      </CompareProvider>
    </SelectedCityProvider>
    </LanguageProvider>
  );
}
