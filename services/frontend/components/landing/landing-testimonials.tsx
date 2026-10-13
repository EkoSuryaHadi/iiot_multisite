import React from "react";

const testimonials = [
  {
    name: "Jane Doe",
    company: "EcoHomes Inc.",
    text: "Smart Energy Management helped us cut our energy costs by 30%. The dashboard is intuitive and the automation features are a game changer!"
  },
  {
    name: "John Smith",
    company: "GreenTech Solutions",
    text: "We integrated all our devices in minutes. The analytics and support are top-notch. Highly recommended for any business!"
  },
  {
    name: "Lisa Chan",
    company: "Homeowner",
    text: "I love how easy it is to monitor and control my smart home. The recommendations are always spot on."
  }
];

export default function LandingTestimonials() {
  return (
    <section className="w-full bg-white dark:bg-black py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-zinc-900 dark:text-white">What Our Users Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {testimonials.map((t, idx) => (
            <div key={idx} className="bg-zinc-50 dark:bg-neutral-900 rounded-lg shadow p-6 flex flex-col items-center">
              <p className="text-zinc-700 dark:text-zinc-200 italic mb-4">“{t.text}”</p>
              <div className="font-semibold text-blue-600 dark:text-blue-400">{t.name}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.company}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
