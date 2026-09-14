# GitHub Actions — secrets & variables for production deploy

Cấu hình tại: **GitHub repo → Settings → Secrets and variables → Actions**

## Secrets (bắt buộc)

| Name | Giá trị |
|------|---------|
| `VPS_SSH_KEY` | Private key SSH vào VPS |

**Cách lấy key (máy bạn đã SSH được):**

1. Mở file (Notepad):
   - `C:\Users\Lenovo\.ssh\id_rsa`  
   - hoặc `E:\WorkSpace\aidr\infra\env\github_actions_deploy_rsa` (bản copy)
2. Copy **toàn bộ** nội dung (từ `-----BEGIN ... PRIVATE KEY-----` đến `END`).
3. GitHub → repo **aidr** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `VPS_SSH_KEY`
   - Value: dán private key

> Không commit private key vào git (đã có trong `.gitignore`).

## Variables (bắt buộc)

| Name | Giá trị |
|------|---------|
| `VPS_HOST` | `42.96.2.38` |
| `VPS_USER` | `root` |

Thêm tại: **Settings → Secrets and variables → Actions → Variables → New repository variable**.

## Variables (tuỳ chọn)

| Name | Mặc định trong workflow |
|------|-------------------------|
| `VITE_CLOUDINARY_CLOUD_NAME` | `lfml2w9a` |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | `aidr_unsigned` |

## Luồng

1. Push / merge vào `main`
2. Build image API → `ghcr.io/<owner>/aidr-api:<sha>`
3. Build FE `dist`
4. SSH/rsync FE + compose/nginx lên `/opt/aidr`
5. VPS `docker pull` API + `up -d` + smoke `/api/health/*`

## Lần đầu

1. Thêm Secrets/Variables như trên
2. Packages: image GHCR của repo (Actions `packages: write` đã bật)
3. Push một commit lên `main` hoặc chạy workflow **Deploy production** thủ công (Actions → Run workflow)

`.env` trên VPS (`/opt/aidr/.env`) **không** bị ghi đè bởi CI — chỉ cập nhật `API_IMAGE=...`.
