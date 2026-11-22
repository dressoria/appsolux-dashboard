import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

import { routes } from "@/config/routes";

import styles from "./plan-gate.module.css";

export function PlanGatePrompt({
  moduleName,
  moduleDescription,
  requiredPlanName,
}: {
  moduleName: string;
  moduleDescription: string;
  requiredPlanName: string;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <span className={styles.iconWrap}>
          <Lock className="size-6" />
        </span>
        <h2 className={styles.title}>{moduleName}</h2>
        <p className={styles.description}>{moduleDescription}</p>
        <p className={styles.planNote}>
          {moduleName} está incluido desde el plan{" "}
          <strong>{requiredPlanName}</strong>.
        </p>
        <Link href={routes.billing} className={styles.cta}>
          Ver planes
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
