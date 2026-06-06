import { DeliveryPartnerApplicationClient } from "@/components/delivery/delivery-partner-application-client";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";

export default function DeliveryPartnerRegisterPage() {
  return (
    <StorefrontFrame>
      <main className="min-h-screen bg-[#FFFCFB] pb-12">
        <section className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ED3500]">
                Local delivery partner
              </p>
              <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-normal text-[#111827] sm:text-4xl lg:text-5xl">
                Become a Delivery Partner
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#667085] sm:text-base sm:leading-7">
                Apply for local delivery assignments. Your details go to admin review first; approved accounts
                get the delivery workspace, wallet, and assigned-order queue.
              </p>
            </div>
            <div className="rounded-lg border border-[#FFE0D6] bg-white p-4 text-sm font-semibold leading-6 text-[#536579] shadow-sm">
              Approval is manual for trust and safety. Submitting this form does not instantly activate delivery
              access.
            </div>
          </div>
          <DeliveryPartnerApplicationClient />
        </section>
      </main>
    </StorefrontFrame>
  );
}
