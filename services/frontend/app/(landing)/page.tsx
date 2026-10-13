import LandingHero from "@/components/landing/landing-hero";
import LandingFeatures from "@/components/landing/landing-features";
//import LandingPricing from "@/components/landing/landing-pricing";
import LandingTestimonials from "@/components/landing/landing-testimonials";

export default function Home() {
  return (
    <>
      <LandingHero />
      <LandingFeatures />
      <LandingTestimonials />
    </>
  );
}
