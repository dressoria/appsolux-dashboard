# Referencias SRI de esta fase

Consulta: 13 de octubre de 2026.

- [Anexos y guías del SRI](https://www.sri.gob.ec/web/intersri/formularios-e-instructivos1): anuncia Programa ATS 1.19.0 para septiembre de 2026 en adelante; catálogo actualizado el 06/08/2026; ficha técnica publicada el 07/02/2025. La versión del programa no se usa como atributo de versión del XML.
- Esquema descargado del enlace oficial de esa página: [ats.xsd](https://descargas.sri.gob.ec/download/anexos/ats/ats.xsd), incluido aquí como `at.xsd`. Se normalizaron exclusivamente los finales de línea y espacios finales; se conserva el esquema y su declaración de codificación.
  - SHA-256 de la descarga original: `4756fe58c139aff5073137ca3b2e66f7a6a55b096861c682b007d5f99b276a9a`.
  - SHA-256 del recurso normalizado: `5d4804b9ede4e637ccc1ffb3f5e22d75abaa4b87e8de67ca399c5eaaafd2bbaf`.
- [Catálogo ATS](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/e6a826af-b22c-40bb-8752-d711f293b8f9/Catalogo_ATS.xls): su publicación fue comprobada, pero la descarga agotó el tiempo de espera. No se implementan equivalencias de códigos a partir de suposiciones. `ATS_CATALOG_MAPPING_PENDING` bloquea el XML de períodos con transacciones.
- [Ficha técnica ATS](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/72d717c2-88ed-47b7-baba-50b87b7198b7/Ficha%20Tecnica%20Transaccional%20Simplificado%20ATS.pdf).
- [Formularios e instructivos del SRI](https://www.sri.gob.ec/web/intersri/formularios-e-instructivos): identifica como vigente la guía IVA actualizada el 15/06/2026.
- [Guía IVA utilizada para los casilleros implementados](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/e084fae5-9677-450c-8161-21e7c3a9f65b/Gu%C3%ADa%20para%20el%20llenado%20del%20Formulario%20Impuesto%20al%20Valor%20Agregado%20IVA.PDF).

`validateAtsXsd()` ejecuta `xmllint --nonet --noout --schema … -`, mediante stdin, sin shell ni archivos temporales de datos fiscales. El esquema se incluye en el bundle standalone. El ejecutable no se instala ni se presupone disponible: si falta, el resultado es `XSD_VALIDATION_PENDING`. Se validó efectivamente una muestra sin transacciones; esto no verifica catálogos ni equivale a aceptación del SRI.
