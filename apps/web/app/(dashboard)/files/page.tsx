import { Protect } from "@clerk/nextjs";

import { FilesView } from "@/modules/files/ui/views/files-view";
import { PremiumFeatureOverlay } from "@/modules/billing/ui/components/premium-feature-overlay";

export default function FilesPage() {
  return (
    <Protect
      condition={(has) => has({ plan: "pro" })}
      fallback={
        <PremiumFeatureOverlay>
          <FilesView />
        </PremiumFeatureOverlay>
      }
    >
      <FilesView />
    </Protect>
  );
}

