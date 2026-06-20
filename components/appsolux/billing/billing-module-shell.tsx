import { BillingModuleSidebar } from "./billing-module-sidebar";

type Props = {
  children: React.ReactNode;
};

export function BillingModuleShell({ children }: Props) {
  return (
    <div className="flex min-h-screen">
      <BillingModuleSidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-[#F0F2F5]">
        {children}
      </div>
    </div>
  );
}
