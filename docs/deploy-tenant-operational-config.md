# Deploy Checklist: Tenant Operational Config

## Objetivo

Desplegar de forma segura la nueva arquitectura de planes, modos operativos y features efectivas.

Esta version introduce:

- `TenantOperationalConfig`
- `TenantFeatureOverride`
- nueva migracion Prisma
- backfill `scripts/maintenance/backfill-tenant-operational-config.mjs`
- admin manual de planes/modos/features
- routing por acceso efectivo

## Riesgo principal

Si la app se despliega sin migrar primero la base de datos, Prisma puede fallar al buscar tablas y enums nuevos.

El riesgo operativo principal es:

1. subir codigo nuevo
2. recrear contenedor
3. arrancar app contra una DB que todavia no tiene `TenantOperationalConfig` y `TenantFeatureOverride`

Por eso el orden correcto es:

1. backup DB
2. `prisma migrate deploy`
3. backfill dry-run
4. backfill real
5. rebuild/recreate Docker
6. smoke checks

## Pre-check local

Ejecutar antes de push:

```bash
git status --short
git log --oneline -10
npx prisma validate
npx prisma generate
npm run lint
npx tsc --noEmit
npm run build
```

Confirmar:

- no hay cambios inesperados
- la migracion existe en el repo
- Prisma valida
- TypeScript compila
- el build pasa

## Push correcto

Usar `master`, no `main`.

```bash
git branch --show-current
git push origin master
```

Detenerse si la rama actual no es `master`.

## VM

Ruta:

```bash
/home/ubuntu/app-bionvers-dashboard
```

Entrar y verificar estado:

```bash
cd /home/ubuntu/app-bionvers-dashboard
git status --short
git branch --show-current
git log --oneline -5
git pull origin master
```

Detenerse si hay conflictos o cambios locales inesperados.

## Backup Postgres

Contenedor DB:

```bash
appsolux-db
```

Guardar backup en:

```bash
/home/ubuntu/backups
```

Comandos:

```bash
mkdir -p /home/ubuntu/backups
docker exec appsolux-db pg_dump -U postgres -d appsolux > /home/ubuntu/backups/appsolux_$(date +%Y%m%d_%H%M%S).sql
ls -lh /home/ubuntu/backups | tail
```

Esperado:

- se genera un `.sql`
- el archivo tiene un tamaño coherente

## Migracion Prisma

Env de produccion:

```bash
/home/ubuntu/app-bionvers-dashboard/.env.production
```

Cargar env:

```bash
set -a
source /home/ubuntu/app-bionvers-dashboard/.env.production
set +a
```

Validar antes de aplicar:

```bash
npx prisma validate
npx prisma migrate status
```

Aplicar migracion:

```bash
npx prisma migrate deploy
```

Esperado:

- Prisma detecta la migracion pendiente
- `migrate deploy` termina sin errores

## Backfill

Script:

```bash
scripts/maintenance/backfill-tenant-operational-config.mjs
```

### Dry-run

El script corre en dry-run por defecto.

```bash
node scripts/maintenance/backfill-tenant-operational-config.mjs
```

Esperado:

- `Starting in dry-run mode`
- una linea por tenant
- `create -> ...` para tenants sin config
- `skip existing config ...` para tenants ya configurados
- resumen final

### Ejecucion real

Aplicar solo despues de revisar el dry-run:

```bash
CONFIRM_TENANT_OPERATIONAL_BACKFILL=true node scripts/maintenance/backfill-tenant-operational-config.mjs
```

Garantias del script:

- no toca `TenantSubscription`
- no toca `User`
- no toca `Membership`
- no toca `PlanUpgradeRequest`
- crea `TenantOperationalConfig` solo si falta
- no pisa configuraciones ya existentes
- deja `sharedErpEnabled=false` por defecto

## Verificacion DB

Verificar tablas nuevas:

```bash
docker exec -it appsolux-db psql -U postgres -d appsolux -c "\dt \"TenantOperationalConfig\""
docker exec -it appsolux-db psql -U postgres -d appsolux -c "\dt \"TenantFeatureOverride\""
```

Comparar tenants vs configs:

```bash
docker exec -it appsolux-db psql -U postgres -d appsolux -c "SELECT COUNT(*) AS tenants FROM \"Tenant\";"
docker exec -it appsolux-db psql -U postgres -d appsolux -c "SELECT COUNT(*) AS configs FROM \"TenantOperationalConfig\";"
```

Detectar tenants sin config:

```bash
docker exec -it appsolux-db psql -U postgres -d appsolux -c "SELECT t.slug FROM \"Tenant\" t LEFT JOIN \"TenantOperationalConfig\" toc ON toc.\"tenantId\" = t.id WHERE toc.id IS NULL;"
```

Esperado:

- tablas nuevas existen
- `tenants` y `configs` coinciden
- la consulta de tenants sin config no devuelve filas

## Docker

Contenedor app:

```bash
app-bionvers-dashboard
```

Red:

```bash
appsolux-network
```

Recomendado antes de build:

```bash
npm ci
npx prisma generate
```

Build:

```bash
docker build -t app-bionvers-dashboard:latest .
```

Recrear contenedor:

```bash
docker rm -f app-bionvers-dashboard || true

docker run -d \
  --name app-bionvers-dashboard \
  --restart unless-stopped \
  --network appsolux-network \
  --env-file /home/ubuntu/app-bionvers-dashboard/.env.production \
  -p 3000:3000 \
  app-bionvers-dashboard:latest
```

Logs:

```bash
docker logs --tail 200 -f app-bionvers-dashboard
```

## Smoke checks

Revisar al menos:

```bash
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:3000/workspace
curl -I http://127.0.0.1:3000/admin/billing
```

Esperado:

- el contenedor responde
- no hay `500`
- `/workspace` carga
- `/admin/billing` carga

## Rollback basico

Si el contenedor no levanta:

1. volver al commit anterior seguro
2. rebuild
3. recrear contenedor
4. no borrar tablas nuevas salvo ultimo recurso

Comandos:

```bash
cd /home/ubuntu/app-bionvers-dashboard
git log --oneline -5
git checkout <commit_anterior_seguro>
npm ci
npx prisma generate
docker build -t app-bionvers-dashboard:rollback .
docker rm -f app-bionvers-dashboard || true

docker run -d \
  --name app-bionvers-dashboard \
  --restart unless-stopped \
  --network appsolux-network \
  --env-file /home/ubuntu/app-bionvers-dashboard/.env.production \
  -p 3000:3000 \
  app-bionvers-dashboard:rollback
```

Importante:

- no resetear DB
- no borrar tablas nuevas
- restaurar backup SQL solo como ultimo recurso manual

## Condiciones para detener el deploy

Detener inmediatamente si ocurre cualquiera de estas:

- conflictos en `git pull`
- `npx prisma validate` falla
- `npx prisma migrate status` o `deploy` falla
- el dry-run del backfill muestra datos raros
- el backfill real falla
- el contenedor no arranca
- `docker logs` muestra error de Prisma o env
- `/workspace` devuelve `500`
- `/admin/billing` devuelve `500`

## Resumen operativo

Orden correcto:

1. validar local
2. push a `master`
3. backup DB en VM
4. `git pull origin master`
5. cargar `.env.production`
6. `npx prisma validate`
7. `npx prisma migrate status`
8. `npx prisma migrate deploy`
9. backfill dry-run
10. backfill real
11. `npx prisma generate`
12. `docker build`
13. recrear contenedor
14. logs
15. smoke checks
