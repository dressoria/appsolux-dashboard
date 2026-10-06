# Servicio propio de datos tributarios SRI

## Fuente oficial verificada

- Catálogo: `https://www.datosabiertos.gob.ec/dataset/registro-unico-de-contribuyentes-ruc`
- API CKAN usada para descubrir recursos: `https://www.datosabiertos.gob.ec/api/3/action/package_search?q=Registro%20Unico%20de%20Contribuyentes&rows=100`
- Organización publicadora: Servicio de Rentas Internas (SRI).
- Licencia declarada: Creative Commons Attribution (CC BY).
- Frecuencia declarada: mensual.
- Distribución: un ZIP/CSV por provincia. No se encontró una descarga nacional consolidada en el catálogo.
- Patrón oficial de descarga: `https://descargas.sri.gob.ec/download/datosAbiertos/SRI_RUC_<Provincia>.zip`.
- Diccionario oficial: `https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/b7b22e05-84cc-4de0-8ec7-6b0537b0a1e2/SRI_RUC_DD.xlsx`.
- Metadatos oficiales: `https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9b2b15a9-467c-4eba-a3c0-939fba419edd/SRI_RUC_PM.xlsx`.

El catálogo se consulta en cada ejecución, por lo que no se mantiene una lista provincial hardcodeada. Las URL `http` antiguas devueltas por el catálogo se normalizan a `https`.
Antes de escribir en la base, el importador exige exactamente 24 provincias únicas. Si el catálogo está incompleto o duplicado, aborta sin iniciar la importación.

## Formato observado

El ZIP de Napo usado como muestra pesó aproximadamente 3.9 MB y su CSV descomprimido 21.2 MB. El CSV usa `|` como delimitador y contiene estas columnas:

`NUMERO_RUC`, `RAZON_SOCIAL`, `CODIGO_JURISDICCION`, `ESTADO_CONTRIBUYENTE`, `CLASE_CONTRIBUYENTE`, `FECHA_INICIO_ACTIVIDADES`, `FECHA_ACTUALIZACION`, `FECHA_SUSPENSION_DEFINITIVA`, `FECHA_REINICIO_ACTIVIDADES`, `OBLIGADO`, `TIPO_CONTRIBUYENTE`, `NUMERO_ESTABLECIMIENTO`, `NOMBRE_FANTASIA_COMERCIAL`, `ESTADO_ESTABLECIMIENTO`, `DESCRIPCION_PROVINCIA_EST`, `DESCRIPCION_CANTON_EST`, `DESCRIPCION_PARROQUIA_EST`, `CODIGO_CIIU`, `ACTIVIDAD_ECONOMICA`, `AGENTE_RETENCION`, `ESPECIAL`.

La importación conserva únicamente el establecimiento matriz (`NUMERO_ESTABLECIMIENTO = 1`) para garantizar un registro por RUC. El conjunto no contiene dirección postal.

## Alcance de identificación

La fuente indexa RUC de 13 dígitos, incluidos RUC de personas naturales. No contiene una columna de cédula y el servicio no elimina los tres últimos dígitos para inferir identidades. Una consulta de cédula continúa al siguiente proveedor configurado o devuelve `found: false`.

## Operación

- `npm run sri:import-taxpayers`: descubre y procesa todos los recursos provinciales.
- `npm run sri:update-taxpayers`: omite la ejecución cuando la versión del catálogo ya fue importada correctamente.

Los archivos se descargan y descomprimen en streaming. Los lotes se insertan o actualizan por RUC. Cada ejecución queda registrada con versión, tiempos y totales; un archivo inválido no elimina información previamente indexada ni detiene los demás archivos.

No se crean archivos temporales: el ZIP viaja desde la respuesta HTTP al descompresor y al lector de líneas. La memoria adicional queda limitada principalmente al descompresor y al lote de 500 registros; debe dimensionarse junto con el consumo base del proceso Node/Prisma. La descarga medida de Napo tardó aproximadamente 0.4 segundos en este entorno, pero el tiempo total por provincia dependerá principalmente de su tamaño, la red y la latencia de PostgreSQL.

Una ejecución incompleta se registra como `partial`, devuelve un código de salida distinto de cero y no se considera una versión terminada. Para reanudar se vuelve a ejecutar el comando: los lotes ya persistidos quedan como `unchanged` y las provincias restantes vuelven a intentarse. No existe continuación dentro del mismo byte del ZIP interrumpido.
