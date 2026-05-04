import type { Metadata } from "next"
import { Footer } from "@/components/footer"
import { ContactLink } from "@/components/contact-link"

export const metadata: Metadata = {
  title: "Terms of Use | nimimo",
  description: "Terms of use for nimimo - self-custodial crypto identity platform.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <h1
            className="text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Terms of Use
          </h1>
          <p className="text-xs text-muted-foreground mb-8">Last updated: April 5, 2026</p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Acceptance</h2>
              <p>
                By accessing or using nimimo ("the Platform"), you agree to these Terms of Use. If you do not agree, do not use the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. Description of Service</h2>
              <p>
                nimimo is a self-custodial crypto identity platform. It provides users with blockchain-based handles, public address resolution, and profile pages. nimimo does not hold, manage, or have access to your private keys or funds.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Self-Custody</h2>
              <p>
                You are solely responsible for securing your seed phrase and private keys. nimimo encrypts your seed phrase on your device using device-bound encryption. nimimo cannot recover lost seed phrases. If you lose access to your device and recovery data, your keys are permanently lost.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Handle Registration</h2>
              <p>
                Handles are assigned on a first-come, first-served basis. You may not register handles that impersonate other individuals, companies, or organizations. You may not register handles containing offensive, hateful, or inappropriate language. nimimo reserves the right to reclaim or reassign handles that violate these terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Handle Upgrades</h2>
              <p>
                Handle upgrades are paid via on-chain cryptocurrency transactions. Payments are non-refundable once confirmed on-chain. nimimo is not responsible for funds sent to incorrect addresses, incorrect amounts, or expired payment intents.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Prohibited Use</h2>
              <p>You agree not to use nimimo to:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Engage in illegal activity or facilitate money laundering</li>
                <li>Impersonate others or misrepresent your identity</li>
                <li>Distribute malware, spam, or phishing content</li>
                <li>Interfere with or disrupt the Platform</li>
                <li>Attempt to access accounts or data that is not yours</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. No Financial Advice</h2>
              <p>
                nimimo does not provide financial, investment, tax, or legal advice. Any information displayed on the Platform, including cryptocurrency prices and balances, is for informational purposes only and may be delayed or inaccurate.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Limitation of Liability</h2>
              <p>
                nimimo is provided "as is" without warranties of any kind. To the fullest extent permitted by law, nimimo and its operators shall not be liable for any loss of funds, loss of data, or any indirect, incidental, or consequential damages arising from your use of the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Termination</h2>
              <p>
                nimimo may suspend or terminate access to the Platform at any time for violation of these terms. Your blockchain addresses and on-chain data remain yours regardless of account status.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">10. Changes to Terms</h2>
              <p>
                We may update these terms from time to time. Continued use of the Platform after changes constitutes acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">11. Contact</h2>
              <p>
                For questions about these terms,{" "}
                <ContactLink topic="Legal" className="underline hover:text-foreground transition-colors">
                  contact us
                </ContactLink>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
