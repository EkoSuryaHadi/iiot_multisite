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
        {name: "Home", href: "/"},
        {name: "About", href: "/about"},
        {name: "Contact", href: "/contact"},
    ];

    return (
       <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-900/95 dark:border-neutral-800/70"> 
         <div className="container mx-auto px-4"> 
            <div className="flex h-16 items-center justify-between py-4">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2">
                        <ThemeLogo />
                    </Link>
                    <div className="hidden md:flex items-center gap-6">
                        {navItems.map((item) => (
                            <Link key={item.name} href={item.href}
                             className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-400">
                                {item.name}
                            </Link>
                        ))}
                    </div>
                </div>     
                <div className="flex items-center gap-4">
                    <ModeToggle />

                    <div className="hidden md:flex items-center gap-2">
                        <Button variant="destructive" asChild>
                            <Link href="/auth/login" >Login</Link>
                        </Button>
                        <Button asChild>
                            <Link href="/auth/register" >Register</Link>
                        </Button>
                    </div>
                    <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}
                    </button>
                </div>
            </div>
            
            {mobileMenuOpen && (
                <div className="md:hidden py-4 space-y-4 border-t">
                    {navItems.map((item) =>(
                        <Link key={item.name} href={item.href}
                        className="block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                        >
                            {item.name}
                        </Link>
                    ))}
                    <div className="flex flex-col gap-2 pt-4">
                        <Button variant="destructive" asChild className="w-full md:w-auto">
                            <Link href="/auth/login">Login</Link>
                        </Button>
                        <Button asChild className="w-full md:w-auto">
                            <Link href="/auth/register">Register</Link>
                        </Button>
                    </div>
                </div>
            )}
         </div>
       </nav>
    );
}