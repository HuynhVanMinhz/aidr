using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Seeding;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/dev")]
public class DevController : ControllerBase
{
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
}
