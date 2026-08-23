using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

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

Console.WriteLine($"Shops: {await db.Shops.CountAsync()}");
Console.WriteLine($"Categories: {await db.Categories.CountAsync()}");
Console.WriteLine($"Products: {await db.Products.CountAsync()}");
Console.WriteLine($"Approved products: {await db.Products.CountAsync(p => p.Status == "Approved")}");

await CatalogDemoSeeder.SeedAsync(db, apiRoot);

var count = await db.Products.CountAsync(p => p.Status == "Approved");
Console.WriteLine($"Catalog demo seed completed. Approved products: {count}");
