# SRI Submission QA

## Alcance

- Solo ambiente `TEST`.
- No produccion.
- No genera RIDE/PDF final.

## Flujo manual

1. Configurar SRI en dashboard.
2. Cargar certificado `.p12` o `.pfx`.
3. Crear venta basica.
4. Crear borrador SRI.
5. Revisar XML preliminar.
6. Pasar checklist tecnico.
7. Marcar `READY_FOR_TESTING`.
8. Solicitar firma.
9. En worker ejecutar:
   - `npm run scan`
   - `npm run run:once`
10. Volver al dashboard y confirmar `SIGNED`.
11. Crear job de envio desde el detalle del documento.
12. En worker ejecutar:
   - `npm run scan:submission`
   - `npm run submit:once`
13. Volver a la UI y confirmar uno de estos resultados:
   - `AUTHORIZED`
   - `REJECTED`
   - `FAILED`

## Casos esperados

- `AUTHORIZED`: el SRI devolvio autorizacion real en pruebas.
- `REJECTED`: el SRI devolvio rechazo funcional o estructural.
- `FAILED`: error tecnico, red, SOAP o configuracion.
- `RECEIVED`: el SRI recibio el XML y la autorizacion sigue en proceso.

## Errores comunes

- Certificado no cargado o contrasena cifrada ausente.
- `ENABLE_SRI_TEST_SUBMISSION=false`.
- `SRI_SIGNED_XML_STORAGE_PATH` incorrecta.
- `DATABASE_URL_WORKER` incorrecta.
- `signed.xml` inexistente.
- Documento aun no esta `SIGNED`.
- El SRI TEST responde `DEVUELTA`.

## Aclaraciones

- `SIGNED` no significa autorizado.
- `AUTHORIZED` en esta fase no implica RIDE ni correo.
- Produccion SRI sigue fuera de alcance.
