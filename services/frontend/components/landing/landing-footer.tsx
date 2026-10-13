export default function LandingFooter() {
  return (
    <footer className="w-full border-t bg-white/90 dark:bg-neutral-900/90 border-neutral-200 dark:border-neutral-800/50 py-6 mt-8">
        {/* Copyright */}
        <div className=" flex justify-center text-xs text-zinc-600 dark:text-zinc-600">&copy; {new Date().getFullYear()} Smart Energy Management</div>

    </footer>
  );
}



