# Deploy: app.bionvers.com

Guía para desplegar `appsolux-dashboard` en la VM con Docker.

## 1. DNS

Crear un A record en el proveedor DNS:

```
app.bionvers.com  →  <IP pública de la VM>
```

Verificar propagación:
```bash
dig +short app.bionvers.com
```

---

## 2. Estructura de directorios en la VM

```bash
# Clonar o copiar el proyecto
cd /home/ubuntu
git clone <repo-url> appsolux-dashboard
# o subir con rsync/scp

# Crear carpetas para storage SRI (fuera del directorio del código)
mkdir -p /home/ubuntu/appsolux-secure/sri-certificates
mkdir -p /home/ubuntu/appsolux-secure/sri-signed-xml
chmod 700 /home/ubuntu/appsolux-secure
chmod 700 /home/ubuntu/appsolux-secure/sri-certificates
chmod 700 /home/ubuntu/appsolux-secure/sri-signed-xml
```

---

## 3. Variables de entorno

```bash
cd /home/ubuntu/appsolux-dashboard
cp .env.production.example .env.production
nano .env.production
```

Puntos críticos:

| Variable | Valor en producción |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@appsolux-db:5432/appsolux_core?schema=public` |
| `NEXT_PUBLIC_APP_URL` | `https://app.bionvers.com` |
| `APPSOLUX_AUTH_SECRET` | 64 hex chars aleatorios |
| `APPSOLUX_ENABLE_DEV_SESSION` | `false` |
| `SRI_CERT_STORAGE_PATH` | `/app/.appsolux-secure/sri-certificates` |
| `SRI_SIGNED_XML_STORAGE_PATH` | `/app/.appsolux-secure/sri-signed-xml` |

**DATABASE_URL dentro de Docker usa el nombre del contenedor, no `localhost`.**
El contenedor `appsolux-db` debe estar en la misma red Docker (`appsolux-network`).

---

## 4. Red Docker

Si la red `appsolux-network` no existe aún:

```bash
docker network create appsolux-network
```

Si ya existe (creada por otro compose), el `docker-compose.prod.yml` la declara como `external: true`.

---

## 5. Migraciones

Aplicar migraciones antes de levantar el servicio (o después de cada deploy que incluya cambios de schema):

```bash
cd /home/ubuntu/appsolux-dashboard

# Opción A: correr migrate dentro de la imagen (requiere DATABASE_URL en entorno)
docker compose -f docker-compose.prod.yml run --rm \
  app-bionvers-dashboard \
  npx prisma migrate deploy

# Opción B: desde la máquina host si el tunnel está disponible
DATABASE_URL="postgresql://user:pass@localhost:5432/appsolux_core?schema=public" \
  npx prisma migrate deploy
```

**Nunca ejecutar `prisma migrate reset` en producción.**

---

## 6. Build y deploy

```bash
cd /home/ubuntu/appsolux-dashboard

# Construir imagen (puede tardar varios minutos)
docker compose -f docker-compose.prod.yml build

# Levantar en background
docker compose -f docker-compose.prod.yml up -d

# Ver logs en vivo
docker logs -f app-bionvers-dashboard
```

---

## 7. Nginx Proxy Manager

Configurar un nuevo Proxy Host en NPM:

| Campo | Valor |
|---|---|
| Domain Names | `app.bionvers.com` |
| Scheme | `http` |
| Forward Hostname / IP | `app-bionvers-dashboard` |
| Forward Port | `3000` |
| SSL Certificate | Request a new Let's Encrypt certificate |
| Force SSL | ✅ habilitado |
| HTTP/2 Support | ✅ habilitado |

Si NPM no puede resolver el nombre del contenedor por Docker network, usar la IP del host o `172.17.0.1`:

| Campo | Valor alternativo |
|---|---|
| Forward Hostname / IP | `127.0.0.1` |
| Forward Port | `3005` |

Y exponer el puerto en `docker-compose.prod.yml`:
```yaml
ports:
  - "3005:3000"
```

---

## 8. Verificar el deploy

```bash
# Health check desde la VM
curl -s http://localhost:3005/api/health

# O desde fuera (con SSL)
curl -s https://app.bionvers.com/api/health
```

---

## 9. Actualizar a nueva versión

```bash
cd /home/ubuntu/appsolux-dashboard

git pull origin master

# Aplicar migraciones si las hay
docker compose -f docker-compose.prod.yml run --rm \
  app-bionvers-dashboard \
  npx prisma migrate deploy

# Rebuild y redeploy (zero-downtime no garantizado sin orquestador)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

## 10. Rollback

```bash
# Bajar el servicio
docker compose -f docker-compose.prod.yml down

# Volver al commit anterior
git checkout <commit-anterior>

# Rebuild con la versión anterior
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

## 11. Seguridad

- `.env.production` **nunca** se commitea al repositorio (está en `.gitignore`).
- Los certificados SRI se montan como volumen, nunca se copian al image.
- El dashboard no debe quedar expuesto en ningún puerto sin pasar por NPM/proxy con SSL.
- El directorio `/home/ubuntu/appsolux-secure` debe tener permisos `700`.
- `APPSOLUX_ENABLE_DEV_SESSION=false` obligatorio en producción.

---

## 12. Worker SRI

El worker `appsolux-workers/sri-signing-worker` se gestiona por separado.
No está incluido en este compose. Ver `docs/SRI_SIGNING_WORKER.md` para su configuración.
