import React from "react";
import { CheckCircle } from "lucide-react";

const features = [
  {
    icon: <CheckCircle className="w-8 h-8 text-blue-600" />, 
    title: "Real-Time Monitoring",
    description: "Track energy usage across all your devices instantly from anywhere."
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-blue-600" />, 
    title: "Automated Optimization",
    description: "AI-driven suggestions to reduce costs and maximize efficiency."
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-blue-600" />, 
    title: "Easy Integration",
    description: "Connect with your smart home and IoT devices in minutes."
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-blue-600" />, 
    title: "Secure & Reliable",
    description: "Enterprise-grade security and 99.99% uptime for your peace of mind."
  }
];

export default function LandingFeatures() {
  return (
    <section id="features" className="w-full bg-white dark:bg-black py-20 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-zinc-900 dark:text-white">Why Choose Smart Energy Management?</h2>
        <p className="text-lg text-zinc-700 dark:text-zinc-200 mb-12 max-w-2xl mx-auto">
          Powerful features designed for homeowners, businesses, and energy professionals.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          {features.map((feature, idx) => (
            <div key={idx} className="flex flex-col items-center bg-zinc-50 dark:bg-neutral-900 rounded-lg p-6 shadow-sm">
              {feature.icon}
              <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-300 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
