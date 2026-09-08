# Smoke test AIDR v2 features (requires API on http://localhost:5080, Development env)
$Base = "http://localhost:5080/api"
$Pass = 0
$Fail = 0

function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$Block
    )
    try {
        & $Block
        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:Pass++
    } catch {
        Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
        $script:Fail++
    }
}

function Post-Dev($Path) {
    Invoke-RestMethod -Method Post -Uri "$Base/dev/$Path" -ContentType "application/json"
}

function Get-Api($Path, $Token = $null) {
    $headers = @{}
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    Invoke-RestMethod -Method Get -Uri "$Base/$Path" -Headers $headers
}

function Post-Api($Path, $Body, $Token = $null) {
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    Invoke-RestMethod -Method Post -Uri "$Base/$Path" -Headers $headers -Body ($Body | ConvertTo-Json)
}

Write-Host "=== AIDR v2 smoke test ===" -ForegroundColor Cyan

Test-Step -Name "Health live" -Block { Get-Api "health/live" | Out-Null }
Test-Step -Name "Health ready" -Block { Get-Api "health/ready" | Out-Null }

Test-Step -Name "Seed demo accounts" -Block { Post-Dev "seed-demo-accounts" | Out-Null }

Test-Step -Name "Seed catalog (skip if products exist)" -Block {
    $existing = Get-Api "products?page=1&pageSize=1"
    if ($existing.data.items -and $existing.data.items.Count -gt 0) {
        Write-Host "  catalog already present, skipped" -ForegroundColor DarkGray
        return
    }
    Post-Dev "seed-catalog" | Out-Null
}
Test-Step -Name "Seed inventory lots" -Block { Post-Dev "seed-inventory-lots" | Out-Null }
Test-Step -Name "Seed price alerts" -Block { Post-Dev "seed-price-alerts" | Out-Null }
Test-Step -Name "Seed review digest" -Block { Post-Dev "seed-review-digest" | Out-Null }
Test-Step -Name "Seed bundle demo" -Block { Post-Dev "seed-bundle-demo" | Out-Null }
Test-Step -Name "Seed product Q and A" -Block { Post-Dev "seed-product-qa" | Out-Null }
Test-Step -Name "Seed reorder demo" -Block { Post-Dev "seed-reorder-demo" | Out-Null }
Test-Step -Name "Seed KYC duplicate" -Block { Post-Dev "seed-kyc-duplicate" | Out-Null }

$login = $null
Test-Step -Name "Buyer login" -Block {
    $script:login = Post-Api "auth/login" @{ email = "buyer@aidr.local"; password = "Aidr@123" }
    if (-not $script:login.data.accessToken) { throw "No access token" }
}
$token = $login.data.accessToken

$productId = $null
Test-Step -Name "List products" -Block {
    $list = Get-Api "products?page=1&pageSize=1"
    if (-not $list.data.items -or $list.data.items.Count -eq 0) { throw "No products" }
    $script:productId = $list.data.items[0].productId
}

if ($productId) {
    Test-Step -Name "GET price-history" -Block {
        $r = Get-Api "products/$productId/price-history?days=90"
        if (-not $r.data.points) { throw "Missing points" }
    }
    Test-Step -Name "GET review-digest" -Block {
        $r = Get-Api "products/$productId/review-digest"
        if ($null -eq $r.data.available) { throw "Missing available flag" }
    }
    Test-Step -Name "GET bundle" -Block {
        $r = Get-Api "products/$productId/bundle"
        if ($null -eq $r.data.items) { throw "Missing bundle items" }
    }
    Test-Step -Name "POST compatibility" -Block {
        $r = Post-Api "ai/compatibility" @{ primaryProductId = $productId; freeTextDevice = "DDR5 laptop" }
        if (-not $r.data.verdict) { throw "Missing verdict" }
    }
    Test-Step -Name "GET product questions" -Block {
        $r = Get-Api "products/$productId/questions"
        if ($null -eq $r.data.items) { throw "Missing Q and A items" }
    }
    Test-Step -Name "GET price alert status (buyer)" -Block {
        $r = Get-Api "price-alerts/products/$productId/status" $token
        if ($null -eq $r.data.priceDrop) { throw "Missing status" }
    }
}

Test-Step -Name "GET following feed" -Block {
    $r = Get-Api "following/feed?page=1&pageSize=10" $token
    if ($null -eq $r.data.items) { throw "Missing feed items" }
}

$orderId = $null
Test-Step -Name "List buyer orders" -Block {
    $r = Get-Api "orders?page=1&pageSize=5" $token
    if ($r.data.items -and $r.data.items.Count -gt 0) {
        $script:orderId = $r.data.items[0].orderId
    }
}

if ($orderId) {
    Test-Step -Name "GET protection timeline" -Block {
        $r = Get-Api "orders/$orderId/protection-timeline" $token
        if (-not $r.data.steps -or $r.data.steps.Count -eq 0) { throw "No timeline steps" }
    }
    Test-Step -Name "POST reorder" -Block {
        $r = Post-Api "orders/$orderId/reorder" @{} $token
        if ($null -eq $r.data.addedCount) { throw "Missing addedCount" }
    }
} else {
    Write-Host "[SKIP] Order-dependent tests (no buyer orders)" -ForegroundColor Yellow
}

Test-Step -Name "Seller login and restock advice" -Block {
    $sellerLogin = Post-Api "auth/login" @{ email = "seller@aidr.local"; password = "Aidr@123" }
    $st = $sellerLogin.data.accessToken
    $r = Get-Api "seller/inventory/restock-advice?days=14" $st
    if ($null -eq $r.data.items) { throw "Missing restock items" }
}

Test-Step -Name "Admin KYC duplicate registration detail" -Block {
    $adminLogin = Post-Api "auth/login" @{ email = "admin@aidr.local"; password = "Aidr@123" }
    $at = $adminLogin.data.accessToken
    $list = Get-Api "admin/seller-registrations?status=Pending&page=1&pageSize=5" $at
    if ($list.data.items -and $list.data.items.Count -gt 0) {
        $rid = $list.data.items[0].requestId
        $detail = Get-Api "admin/seller-registrations/$rid" $at
        if ($null -eq $detail.data) { throw "No registration detail" }
    }
}

Test-Step -Name "GET shop with badges" -Block {
    $shops = Get-Api "shops?page=1&pageSize=1"
    if ($shops.data.items -and $shops.data.items.Count -gt 0) {
        $slug = $shops.data.items[0].slug
        $r = Get-Api "shops/$slug"
        if ($null -eq $r.data.badges) { throw "Missing badges array" }
    } else {
        throw "No active shops"
    }
}

Write-Host ""
Write-Host "=== Results: $Pass passed, $Fail failed ===" -ForegroundColor Cyan
if ($Fail -gt 0) { exit 1 }
