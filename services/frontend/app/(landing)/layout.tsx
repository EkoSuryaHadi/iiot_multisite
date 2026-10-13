import {ThemeProvider} from "@/components/theme-provider";
import LandingNavbar from "@/components/landing/landing-navbar";
import LandingFooter from "@/components/landing/landing-footer";
import {Toaster} from "react-hot-toast";


export default function LayoutLanding({ 
    children }: { children: React.ReactNode 

    }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="min-h-screen flex flex-col">
        <LandingNavbar />
         <main className="flex-1">
         {children}
         </main>
     <LandingFooter />
      </div>
      <Toaster position="top-center" reverseOrder={false}/>
    </ThemeProvider>
  );
}