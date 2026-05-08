import QueryProvider from "../components/landing/QueryProvider";
import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/sections/Hero";
import Problem from "../components/landing/sections/Problem";
import Solution from "../components/landing/sections/Solution";
import Features from "../components/landing/sections/Features";
import HowItWorks from "../components/landing/sections/HowItWorks";
import ProductPreview from "../components/landing/sections/ProductPreview";
import Benefits from "../components/landing/sections/Benefits";
import Testimonials from "../components/landing/sections/Testimonials";
import Pricing from "../components/landing/sections/Pricing";
import FinalCTA from "../components/landing/sections/FinalCTA";
import Footer from "../components/landing/sections/Footer";
import Cursor from "../components/landing/CustomCursor";

export default function LandingPage() {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-background">
        <Cursor />
        <Navbar />
        <main>
          <Hero />
          <Problem />
          <Solution />
          <Features />
          <HowItWorks />
          <ProductPreview />
          <Benefits />
          <Testimonials />
          <Pricing />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </QueryProvider>
  );
}
