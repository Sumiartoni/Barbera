import Navbar from "@/components/Navbar";
import Hero from "@/components/sections/Hero";
import Problem from "@/components/sections/Problem";
import Solution from "@/components/sections/Solution";
import Features from "@/components/sections/Features";
import ProductPreview from "@/components/sections/ProductPreview";
import HowItWorks from "@/components/sections/HowItWorks";
import Benefits from "@/components/sections/Benefits";
import Pricing from "@/components/sections/Pricing";
import Testimonials from "@/components/sections/Testimonials";
import FinalCTA from "@/components/sections/FinalCTA";
import Footer from "@/components/sections/Footer";
import CustomCursor from "@/components/CustomCursor";
import { Scroll3DSection, ScrollProgressBar, ParallaxLayer } from "@/components/Scroll3DEffect";
import BarberPole from "@/components/BarberPole";

const Index = () => (
  <main className="min-h-screen bg-background">
    {/* Custom cursor */}
    <CustomCursor />

    {/* Scroll progress bar */}
    <ScrollProgressBar />

    <Navbar />
    <Hero />

    {/* Decorative barber pole divider */}
    <div className="relative flex justify-center items-center py-4 bg-background overflow-hidden">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border/40" />
      </div>
      <div className="relative z-10 bg-background px-8">
        <BarberPole size="sm" showGlow={false} />
      </div>
    </div>

    <Scroll3DSection depth={3} direction="left">
      <Problem />
    </Scroll3DSection>

    <Scroll3DSection depth={4} direction="right">
      <Solution />
    </Scroll3DSection>

    <Scroll3DSection depth={3}>
      <Features />
    </Scroll3DSection>

    {/* Another decorative divider */}
    <div className="relative flex justify-center items-center py-4 bg-background overflow-hidden">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border/40" />
      </div>
      <div className="relative z-10 bg-background px-8 flex gap-6 items-end">
        <BarberPole size="sm" showGlow={false} />
        <BarberPole size="md" showGlow />
        <BarberPole size="sm" showGlow={false} />
      </div>
    </div>

    <Scroll3DSection depth={5} direction="left">
      <ProductPreview />
    </Scroll3DSection>

    <Scroll3DSection depth={3} direction="right">
      <HowItWorks />
    </Scroll3DSection>

    <Scroll3DSection depth={4}>
      <Benefits />
    </Scroll3DSection>

    <Scroll3DSection depth={3} direction="left">
      <Pricing />
    </Scroll3DSection>

    <Scroll3DSection depth={4} direction="right">
      <Testimonials />
    </Scroll3DSection>

    <Scroll3DSection depth={5}>
      <FinalCTA />
    </Scroll3DSection>

    <Footer />
  </main>
);

export default Index;
