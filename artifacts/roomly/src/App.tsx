import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

import { HomePage } from "@/pages/HomePage";
import { ListingsPage } from "@/pages/ListingsPage";
import { ListingDetailPage } from "@/pages/ListingDetailPage";
import { NewListingPage } from "@/pages/NewListingPage";
import { EditListingPage } from "@/pages/EditListingPage";
import { FavoritesPage } from "@/pages/FavoritesPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { ConversationPage } from "@/pages/ConversationPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { WelcomePage } from "@/pages/WelcomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { MapPage } from "@/pages/MapPage";

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-6xl font-black text-stone-200">404</p>
      <h1 className="mt-4 text-xl font-semibold text-stone-900">Pagina niet gevonden</h1>
      <p className="mt-2 text-sm text-stone-500">De pagina die je zoekt bestaat niet.</p>
      <a href="/" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Terug naar home</a>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/kamers" component={ListingsPage} />
      <Route path="/kamers/nieuw" component={NewListingPage} />
      <Route path="/kamers/:id/bewerken" component={EditListingPage} />
      <Route path="/kamers/:id" component={ListingDetailPage} />
      <Route path="/kaart" component={MapPage} />
      <Route path="/favorieten" component={FavoritesPage} />
      <Route path="/berichten" component={MessagesPage} />
      <Route path="/berichten/:id" component={ConversationPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/profiel" component={ProfilePage} />
      <Route path="/welkom" component={WelcomePage} />
      <Route path="/inloggen" component={LoginPage} />
      <Route path="/registreren" component={RegisterPage} />
      <Route path="/wachtwoord-vergeten" component={ForgotPasswordPage} />
      <Route path="/wachtwoord-instellen" component={ResetPasswordPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
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
  );
}
