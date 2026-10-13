import type { AtsPeriodData } from "./ats-data";

export function validateAtsData(data: AtsPeriodData) {
  return {
    domainStatus: data.domainStatus,
    xsdStatus: data.xsdStatus,
    xmlStatus: data.xmlStatus,
    issues: data.issues,
    catalogMappingStatus: data.catalogMappingStatus,
  };
}
