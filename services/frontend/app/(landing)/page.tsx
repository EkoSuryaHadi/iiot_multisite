import LandingHero from "@/components/landing/landing-hero";
import LandingFeatures from "@/components/landing/landing-features";
import LandingArchitecture from "@/components/landing/landing-architecture";

export default function Home() {
  return (
    <div className="w-full flex flex-col min-h-screen">
      <LandingHero />
      <LandingFeatures />
      <LandingArchitecture />
    </div>
  );
}
