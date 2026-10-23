import Link from "next/link";

const Footer = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  return (
    <footer className="bg-white dark:bg-[#273142] border-t border-neutral-200 dark:border-slate-700/80 py-4 px-6 mt-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
        <p className="mb-0 text-neutral-600 dark:text-neutral-400">
          &copy; {currentYear} <span className="font-semibold text-neutral-900 dark:text-white">IIoT Multi-Site Platform</span>. All Rights Reserved.
        </p>
        <p className="mb-0 text-neutral-500 dark:text-neutral-400 text-xs">
          Industrial IoT Monitoring & Ingestion System
        </p>
      </div>
    </footer>
  );
};

export default Footer;
