import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { Toaster } from "sonner";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { SelectedCityProvider } from "@/contexts/SelectedCityContext";

import { HomePage } from "@/pages/HomePage";
import { ListingsPage } from "@/pages/ListingsPage";
import { NewListingPage } from "@/pages/NewListingPage";
import { EditListingPage } from "@/pages/EditListingPage";
import { FavoritesPage } from "@/pages/FavoritesPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { ConversationPage } from "@/pages/ConversationPage";
import { WelcomePage } from "@/pages/WelcomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";

const ListingDetailPage = lazy(() => import("@/pages/ListingDetailPage").then((m) => ({ default: m.ListingDetailPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const MapPage = lazy(() => import("@/pages/MapPage").then((m) => ({ default: m.MapPage })));

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
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Component />
        </Suspense>
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
      <Route path="/kamers/:id" component={() => <AnimatedRoute component={ListingDetailPage} />} />
      <Route path="/kaart" component={() => <AnimatedRoute component={MapPage} />} />
      <Route path="/favorieten" component={() => <AnimatedRoute component={FavoritesPage} />} />
      <Route path="/berichten" component={() => <AnimatedRoute component={MessagesPage} />} />
      <Route path="/berichten/:id" component={() => <AnimatedRoute component={ConversationPage} />} />
      <Route path="/dashboard" component={() => <AnimatedRoute component={DashboardPage} />} />
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
  );
}
