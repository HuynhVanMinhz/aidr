using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

// Applies scripts/product-variants-schema.sql and converts a few demo products into
// variant products, then verifies the result. Same job as POST /api/dev/seed-product-variants,
// runnable without the API up:
//
//     dotnet run --project scripts/VariantSeedRunner

var repoRoot = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", ".."));
var apiRoot = Path.Combine(repoRoot, "aidr-be", "AIDR.Api");

var config = new ConfigurationBuilder()
    .SetBasePath(apiRoot)
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile("appsettings.Development.json", optional: false)
    .Build();

var connectionString = config.GetConnectionString("AidrDb")
    ?? throw new InvalidOperationException("ConnectionStrings:AidrDb is missing.");

var options = new DbContextOptionsBuilder<AidrDbContext>()
    .UseSqlServer(connectionString)
    .Options;

await using var db = new AidrDbContext(options);

Console.WriteLine($"Connection: {connectionString}");
Console.WriteLine();

Console.WriteLine("--- Seeding ---");
foreach (var line in await ProductVariantsDemoSeeder.SeedAsync(db, apiRoot))
    Console.WriteLine("  " + line);

Console.WriteLine();
Console.WriteLine("--- Catalogue ---");

var products = await db.Products.AsNoTracking()
    .Where(p => p.VariantOptionsJson != null)
    .OrderBy(p => p.Name)
    .Select(p => new
    {
        p.Name,
        p.BasePrice,
        p.StockQuantity,
        Variants = p.Variants
            .OrderBy(v => v.SortOrder)
            .Select(v => new { v.VariantName, v.Price, v.SalePrice, v.StockQuantity, v.Sku })
            .ToList(),
    })
    .ToListAsync();

foreach (var p in products)
{
    Console.WriteLine();
    Console.WriteLine($"{p.Name}  —  from {p.BasePrice:N0}, stock {p.StockQuantity}");
    foreach (var v in p.Variants)
    {
        var sale = v.SalePrice is { } s ? $" sale {s,12:N0}" : new string(' ', 18);
        Console.WriteLine($"    {v.VariantName,-24} {v.Price,12:N0}{sale}  stock {v.StockQuantity,3}  {v.Sku}");
    }
}

Console.WriteLine();
Console.WriteLine("--- Verification ---");

var report = await DataIntegritySeeder.ValidateAsync(db, apiRoot);
Console.WriteLine($"Integrity rules: {report.RulesChecked}, issues: {report.IssueCount}, healthy: {report.IsHealthy}");

// Stock a buyer can see must be stock the checkout can actually allocate, which means every
// variant's StockQuantity has to equal the sum of its own lots.
var lotGaps = await db.ProductVariants.AsNoTracking()
    .Where(v => v.Product.VariantOptionsJson != null)
    .Select(v => new
    {
        v.Product.Name,
        v.VariantName,
        v.StockQuantity,
        LotSum = db.InventoryLots
            .Where(l => l.VariantId == v.VariantId && l.Status != "Void")
            .Sum(l => (int?)l.QuantityRemaining) ?? 0,
    })
    .Where(x => x.StockQuantity != x.LotSum)
    .ToListAsync();

var rollupGaps = await db.Products.AsNoTracking()
    .Where(p => p.VariantOptionsJson != null)
    .Select(p => new
    {
        p.Name,
        p.StockQuantity,
        VariantSum = db.ProductVariants.Where(v => v.ProductId == p.ProductId).Sum(v => (int?)v.StockQuantity) ?? 0,
        p.BasePrice,
        Cheapest = db.ProductVariants
            .Where(v => v.ProductId == p.ProductId && v.IsActive)
            .Min(v => (decimal?)v.Price) ?? 0m,
    })
    .Where(x => x.StockQuantity != x.VariantSum || x.BasePrice != x.Cheapest)
    .ToListAsync();

// A cart line added before the product gained variants can no longer be checked out.
var strandedCarts = await db.CartItems.AsNoTracking()
    .CountAsync(i => i.VariantId == null && i.Product.VariantOptionsJson != null);

Console.WriteLine($"Variants whose stock disagrees with their lots : {lotGaps.Count}");
foreach (var x in lotGaps)
    Console.WriteLine($"  {x.Name} / {x.VariantName}: stock {x.StockQuantity} vs lots {x.LotSum}");

Console.WriteLine($"Products whose rollups are stale              : {rollupGaps.Count}");
foreach (var x in rollupGaps)
    Console.WriteLine($"  {x.Name}: stock {x.StockQuantity} vs {x.VariantSum}, base {x.BasePrice:N0} vs {x.Cheapest:N0}");

Console.WriteLine($"Cart lines stranded by the conversion         : {strandedCarts}");
Console.WriteLine($"Unassigned lots on variant products           : "
    + await db.InventoryLots.CountAsync(l => l.VariantId == null && l.Product.VariantOptionsJson != null));
