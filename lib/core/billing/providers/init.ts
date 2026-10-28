import { registerBillingProvider } from "./registry.ts";
import { stripeProvider } from "./stripe.ts";
import { paddleProvider } from "./paddle.ts";
import { kushkiProvider } from "./kushki.ts";
import { payphoneProvider } from "./payphone.ts";
import { cryptoProvider } from "./crypto.ts";

let initialized = false;

export function ensureBillingProvidersInitialized() {
  if (initialized) return;
  registerBillingProvider(stripeProvider);
  registerBillingProvider(paddleProvider);
  registerBillingProvider(kushkiProvider);
  registerBillingProvider(payphoneProvider);
  registerBillingProvider(cryptoProvider);
  initialized = true;
}
