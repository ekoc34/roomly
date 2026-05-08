import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { Toaster } from "sonner";
import { useEffect, useRef, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { SelectedCityProvider } from "@/contexts/SelectedCityContext";
import { PageLoader } from "@/components/PageLoader";

import { HomePage } from "@/pages/HomePage";
import { ListingsPage } from "@/pages/ListingsPage";
import { NewListingPage } from "@/pages/NewListingPage";
import { EditListingPage } from "@/pages/EditListingPage";
import { FavoritesPage } from "@/pages/FavoritesPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { ConversationPage } from "@/pages/ConversationPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { WelcomePage } from "@/pages/WelcomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";

// Lazy load heavy pages
const ListingDetailPage = lazy(() => import("@/pages/ListingDetailPage"));
const MapPage = lazy(() => import("@/pages/MapPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));

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
  // Update key only on genuine navigation (not re-renders)
  useEffect(() => { keyRef.current = path; }, [path]);
  return (
    <PageTransition key={path}>
      <ErrorBoundary>
        <Component />
      </ErrorBoundary>
    </PageTransition>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <AnimatedRoute component={HomePage} />} />
      <Route path="/kamers" component={() => <AnimatedRoute component={ListingsPage} />} />
      <Route path="/kamers/nieuw" component={() => <AnimatedRoute component={NewListingPage} />} />
      <Route path="/kamers/:id/bewerken" component={() => <AnimatedRoute component={EditListingPage} />} />
      <Route path="/kamers/:id" component={() => (
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoute component={ListingDetailPage} />
        </Suspense>
      )} />
      <Route path="/kaart" component={() => (
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoute component={MapPage} />
        </Suspense>
      )} />
      <Route path="/favorieten" component={() => <AnimatedRoute component={FavoritesPage} />} />
      <Route path="/berichten" component={() => <AnimatedRoute component={MessagesPage} />} />
      <Route path="/berichten/:id" component={() => <AnimatedRoute component={ConversationPage} />} />
      <Route path="/dashboard" component={() => (
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoute component={DashboardPage} />
        </Suspense>
      )} />
      <Route path="/profiel" component={() => <AnimatedRoute component={ProfilePage} />} />
      <Route path="/welkom" component={() => <AnimatedRoute component={WelcomePage} />} />
      <Route path="/inloggen" component={() => <AnimatedRoute component={LoginPage} />} />
      <Route path="/registreren" component={() => <AnimatedRoute component={RegisterPage} />} />
      <Route path="/wachtwoord-vergeten" component={() => <AnimatedRoute component={ForgotPasswordPage} />} />
      <Route path="/wachtwoord-instellen" component={() => <AnimatedRoute component={ResetPasswordPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <SelectedCityProvider>
        <div className="flex min-h-screen flex-col bg-stone-50">
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Header />
            <main className="flex-1">
              <Router />
            </main>
            <Footer />
            <MobileBottomNav />
          </WouterRouter>
          <Toaster position="bottom-right" richColors closeButton />
        </div>
      </SelectedCityProvider>
    </HelmetProvider>
  );
}
