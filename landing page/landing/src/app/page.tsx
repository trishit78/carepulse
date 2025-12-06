import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { CustomCursor } from "@/components/layout/CustomCursor";
import { Header } from "@/components/layout/Header";
import { Hero } from "@/components/home/Hero";
import { Showreel } from "@/components/home/Showreel";
import { Impact } from "@/components/home/Impact";
import { Work } from "@/components/home/Work";
import { Process } from "@/components/home/Process";
import { Services } from "@/components/home/Services";
import { FAQ } from "@/components/home/FAQ";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground cursor-none">
      <SmoothScroll />
      <CustomCursor />
      <Header />
      <Hero />
      <Showreel />
      <Impact />
      <Work />
      <Process />
      <Services />
      <FAQ />
      <Footer />
    </main>
  );
}
