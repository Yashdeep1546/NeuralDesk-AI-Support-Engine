"use client";

import { PricingTable } from "@clerk/nextjs";

export const Pricing = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-y-4">
      {/* 
        This single component automatically fetches the 'Free' and 'Pro' 
        plans you just created in the Clerk Dashboard! 
      */}
      <PricingTable for="organization" />
    </div>
  );
};
