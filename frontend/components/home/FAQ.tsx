"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Minus, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

const faqs = [
  {
    question: "What are your focus areas as a UI/UX design agency?",
    answer: (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <p>
          Back in 2021, Wavespace started with one simple goal: to create great user experiences that leave a mark. Over the years, we've grown from a small team to a trusted UI UX design agency for startups, SaaS brands, and forward-thinking businesses around the world.
        </p>
        <p>
          Our focus is always on making designs that look great and work well. As a team of UX experts, we love working with new tech like AI and Web3, building easy-to-use answers for tricky problems. Whether it's a mobile app for a startup or a SaaS tool built to grow, we make sure every screen is both good-looking and easy to use.
        </p>
        <p>
          At Wavespace, we take time to know your brand and your users. From planning to testing, we tweak every part to make smooth and fun user paths. Our skills include UI UX design, web building, branding, and more, but we love turning ideas into designs that work.
        </p>
        <p>
          What makes us a top UI UX agency is our love for fresh ideas and teamwork. We don't just make designs; we work with you to bring your idea to life. Each project is a chance to build something amazing—and we can't wait to do it for you.
        </p>
      </div>
    )
  },
  {
    question: "Why is UI/UX design important for your business growth?",
    answer: "UI/UX design is crucial because it directly impacts customer satisfaction and retention. A well-designed product not only attracts users but keeps them engaged, leading to higher conversion rates and business growth."
  },
  {
    question: "My website isn't generating enough leads. How can your design help?",
    answer: "We analyze your current site to identify friction points. By improving navigation, clarifying your value proposition, and optimizing call-to-action placements, we create a user journey that drives conversions."
  },
  {
    question: "What separates Wavespace from other top UI/UX design agencies?",
    answer: "Our unique blend of aesthetic excellence and data-driven strategy separates us. We don't just design for looks; we design for performance, ensuring your product solves real user problems while looking world-class."
  },
  {
    question: "How could you help us redesign our app, website, or enterprise/B2B software?",
    answer: "We start with a comprehensive audit of your existing platform, followed by user research. We then move to wireframing and prototyping, ensuring we address core usability issues before delivering the final polished UI."
  },
  {
    question: "Do you work with startups or only with B2B/enterprise companies?",
    answer: "We work with both! We love the agility of startups and helping them define their MVP, but we also have the process and rigor required for large-scale enterprise transformations."
  },
  {
    question: "Can a redesign boost more traffic and enhance user experience?",
    answer: "Absolutely. A redesign often improves site speed, mobile responsiveness, and SEO structure, all of which contribute to higher organic traffic. Simpler navigation also encourages users to stay longer and explore more."
  }
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="container mx-auto max-w-[1800px] px-6">
        <h2 className="text-4xl md:text-6xl font-bold mb-16 tracking-tight">
          Frequently asked <br /> questions
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-start">
          {/* Left Column: Accordion */}
          <div className="lg:col-span-8">
            <div className="flex flex-col">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-gray-200 last:border-0">
                  <button
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                    className="w-full py-8 flex items-start justify-between text-left group"
                  >
                    <span className="text-xl md:text-2xl font-medium text-black group-hover:text-slate-600 transition-colors pr-8">
                      {faq.question}
                    </span>
                    <span className="shrink-0 mt-1 text-slate-400">
                      {openIndex === index ? (
                        <ArrowUpRight className="w-6 h-6 rotate-45" /> 
                      ) : (
                        <ArrowUpRight className="w-6 h-6" />
                      )}
                    </span>
                  </button>
                  <AnimatePresence>
                    {openIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pb-8 text-lg">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Contact Card */}
          <div className="lg:col-span-4 sticky top-10">
            <div className="bg-[#111] text-white p-8 md:p-12 rounded-3xl flex flex-col items-start gap-6">
              <div className="w-20 h-20 rounded-xl overflow-hidden relative border-2 border-white/10">
                {/* Placeholder for Shahid's image */}
                <Image
                   src="/icon.png"
                   alt="Carepulse Team"
                   fill
                   className="object-cover"
                />
              </div>
              
              <p className="text-lg md:text-xl font-medium leading-relaxed">
                Hi, This is Carepulse Team,please dont hesitate to ask us any questions, we are here to answer all your questions!
              </p>

              <Button 
                className="bg-[#D1F848] hover:bg-[#bce336] text-black text-lg px-8 py-6 rounded-full font-bold w-full md:w-auto mt-4 transition-transform hover:scale-105"
              >
                Ask Questions <span className="ml-2">💬</span> {/* WhatsApp icon placeholder */}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
