import React from "react";

const plans = [
  {
    name: "Starter",
    price: "$9/mo",
    features: ["Up to 5 devices", "Basic analytics", "Email support"]
  },
  {
    name: "Pro",
    price: "$29/mo",
    features: ["Up to 25 devices", "Advanced analytics", "Priority email support", "Automation"]
  },
  {
    name: "Enterprise",
    price: "Contact Us",
    features: ["Unlimited devices", "Custom integrations", "Dedicated support", "SLAs"]
  }
];

export default function LandingPricing() {
  return (
    <section id="pricing" className="w-full bg-blue-50 dark:bg-neutral-900 py-20 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-zinc-900 dark:text-white">Pricing Plans</h2>
        <p className="text-lg text-zinc-700 dark:text-zinc-200 mb-12 max-w-2xl mx-auto">
          Flexible pricing for every need. Start with a free trial—no credit card required.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <div key={idx} className="bg-white dark:bg-neutral-800 rounded-lg shadow p-8 flex flex-col items-center">
              <h3 className="text-2xl font-semibold mb-2 text-zinc-900 dark:text-white">{plan.name}</h3>
              <div className="text-3xl font-bold mb-4 text-blue-600 dark:text-blue-400">{plan.price}</div>
              <ul className="mb-6 space-y-2 text-zinc-700 dark:text-zinc-200">
                {plan.features.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
              <a href="#" className="px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">Choose Plan</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
