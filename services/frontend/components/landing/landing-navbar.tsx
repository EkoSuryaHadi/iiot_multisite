"use client";

import Link from "next/link";
import {Button} from "@/components/ui/button";
import ThemeLogo from "@/components/shared/theme-logo";
import {ModeToggle} from "@/components/shared/mode-toggle";
import {Menu, X} from "lucide-react";
import {useState} from "react";

export default function LandingNavbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems = [
        {name: "Capabilities", href: "#capabilities"},
        {name: "Data Pipeline", href: "#architecture"},
        {name: "Multi-Plant Telemetry", href: "#telemetry-preview"},
        {name: "Engine Specs", href: "#specs"},
    ];

    return (
       <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/70 dark:bg-zinc-950/90 dark:border-zinc-800"> 
         <div className="container mx-auto px-4 lg:px-8"> 
            <div className="flex h-16 items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-3">
                        <ThemeLogo />
                    </Link>
                    <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        GATEWAY ACTIVE // 99.98%
                    </div>
                    <div className="hidden md:flex items-center gap-6 pl-2">
                        {navItems.map((item) => (
                            <Link key={item.name} href={item.href}
                             className="text-xs font-mono uppercase tracking-wider text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">
                                {item.name}
                            </Link>
                        ))}
                    </div>
                </div>     
                <div className="flex items-center gap-3">
                    <ModeToggle />

                    <div className="hidden sm:flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild className="text-xs font-mono">
                            <Link href="/auth/login">Login</Link>
                        </Button>
                        <Button size="sm" asChild className="text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 border border-zinc-700 dark:border-zinc-300">
                            <Link href="/auth/register">Console Access &rarr;</Link>
                        </Button>
                    </div>
                    <button 
                        className="md:hidden p-1.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300" 
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}
                    </button>
                </div>
            </div>
            
            {mobileMenuOpen && (
                <div className="md:hidden py-4 space-y-3 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 px-2 py-1 rounded text-xs font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        GATEWAY ACTIVE // 99.98%
                    </div>
                    {navItems.map((item) => (
                        <Link key={item.name} href={item.href}
                        className="block text-sm font-mono text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                        >
                            {item.name}
                        </Link>
                    ))}
                    <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <Button variant="outline" size="sm" asChild className="w-full text-xs font-mono">
                            <Link href="/auth/login">Login</Link>
                        </Button>
                        <Button size="sm" asChild className="w-full text-xs font-mono">
                            <Link href="/auth/register">Console Access</Link>
                        </Button>
                    </div>
                </div>
            )}
         </div>
       </nav>
    );
}