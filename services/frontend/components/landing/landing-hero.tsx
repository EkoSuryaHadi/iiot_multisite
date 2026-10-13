import React from "react";

export default function LandingHero() {
  return (
    <section className="w-full bg-gradient-to-b from-blue-50 to-white dark:from-neutral-900 dark:to-black py-24 px-6 flex flex-col items-center text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-6 max-w-2xl">
        Smart Energy Management
      </h1>
      <p className="text-lg md:text-xl text-zinc-700 dark:text-zinc-200 mb-8 max-w-xl">
        Optimize your energy usage, reduce costs, and manage your smart devices with ease. The SaaS platform for modern energy management.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="#pricing" className="px-8 py-3 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">Get Started</a>
        <a href="#features" className="px-8 py-3 rounded border border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 dark:hover:bg-neutral-800 transition-colors">Learn More</a>
      </div>
      
    </section>
  );
}
