using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Seeding;
using AIDR.Modules.Auth.Abstractions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/dev")]
public class DevController : ControllerBase
{
    /// <summary>Ensure demo admin/seller/buyer accounts exist with a known password (dev only).</summary>
    [HttpPost("seed-demo-accounts")]
    public async Task<IActionResult> SeedDemoAccounts(
        [FromServices] AidrDbContext db,
        [FromServices] IPasswordHasher passwordHasher,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var result = await DemoAccountsSeeder.SeedAsync(db, passwordHasher, ct);
        return Ok(new
        {
            message = "Demo accounts seeded.",
            password = result.Password,
            accounts = result.Accounts
        });
    }

    [HttpPost("seed-catalog")]
    public async Task<IActionResult> SeedCatalog(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await CatalogDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var count = await db.Products.CountAsync(p => p.Status == "Approved", ct);

        return Ok(new
        {
            message = "Catalog demo seed completed.",
            approvedProductCount = count
        });
    }

    [HttpPost("seed-categories")]
    public async Task<IActionResult> SeedCategories(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await CategoryHierarchyDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var total = await db.Categories.CountAsync(ct);
        var roots = await db.Categories.CountAsync(c => c.ParentId == null, ct);
        var children = total - roots;

        return Ok(new
        {
            message = "Category hierarchy demo seed completed.",
            totalCount = total,
            rootCount = roots,
            childCount = children
        });
    }

    [HttpPost("seed-seller-registrations")]
    public async Task<IActionResult> SeedSellerRegistrations(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await SellerRegistrationDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var pending = await db.SellerRegistrationRequests.CountAsync(r => r.Status == "Pending", ct);
        var total = await db.SellerRegistrationRequests.CountAsync(ct);

        return Ok(new
        {
            message = "Seller registration demo seed completed.",
            pendingCount = pending,
            totalCount = total
        });
    }

    [HttpPost("seed-vouchers")]
    public async Task<IActionResult> SeedVouchers(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var result = await VoucherDemoSeeder.SeedAsync(db, ct);
        return Ok(new
        {
            message = "Voucher demo seed completed.",
            vouchers = result.Vouchers
        });
    }
}
