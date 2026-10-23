"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Activity,
  Building2,
  House,
  MapPin,
  Moon,
  Search,
  Server,
  Sun,
  UsersRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";

const SearchBox = () => {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { data: session } = useSession();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const userRole = session?.user?.role;
  const canAccessTenants = userRole === "superadmin";
  const canAccessUsers = userRole === "superadmin" || userRole === "tenant_admin";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex items-center w-full sm:w-65 md:w-80 h-10 px-3 ps-10 rounded-lg text-sm text-neutral-500 dark:text-neutral-400 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Search className="absolute inset-s-3.5 text-neutral-500 dark:text-neutral-400 size-4" />
        <span className="truncate">Search menus, sites, devices...</span>
        <kbd className="hidden sm:inline-flex ms-auto pointer-events-none h-5 select-none items-center gap-1 rounded border border-neutral-300 dark:border-slate-600 bg-neutral-200/50 dark:bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Navigation & Command Menu"
        description="Search menus and actions across IIoT Multi-site..."
      >
        <CommandInput placeholder="Type a menu or command to search..." />
        <CommandList className="max-h-90">
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Menu Utama">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/dashboard"))}
              className="cursor-pointer"
            >
              <House className="me-2 size-4 text-primary" />
              <span>Dashboard</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/sites"))}
              className="cursor-pointer"
            >
              <MapPin className="me-2 size-4 text-emerald-500" />
              <span>Sites</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/devices"))}
              className="cursor-pointer"
            >
              <Server className="me-2 size-4 text-blue-500" />
              <span>Devices</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => router.push("/telemetry"))}
              className="cursor-pointer"
            >
              <Activity className="me-2 size-4 text-amber-500" />
              <span>Telemetry</span>
            </CommandItem>
          </CommandGroup>

          {(canAccessTenants || canAccessUsers) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Manajemen">
                {canAccessTenants && (
                  <CommandItem
                    onSelect={() => runCommand(() => router.push("/tenants"))}
                    className="cursor-pointer"
                  >
                    <Building2 className="me-2 size-4 text-purple-500" />
                    <span>Tenants</span>
                  </CommandItem>
                )}
                {canAccessUsers && (
                  <CommandItem
                    onSelect={() => runCommand(() => router.push("/users"))}
                    className="cursor-pointer"
                  >
                    <UsersRound className="me-2 size-4 text-indigo-500" />
                    <span>Users</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Tampilan & Aksi">
            <CommandItem
              onSelect={() =>
                runCommand(() => setTheme(theme === "dark" ? "light" : "dark"))
              }
              className="cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="me-2 size-4 text-yellow-500" />
              ) : (
                <Moon className="me-2 size-4 text-slate-500" />
              )}
              <span>
                Ganti ke Mode {theme === "dark" ? "Terang (Light)" : "Gelap (Dark)"}
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default SearchBox;