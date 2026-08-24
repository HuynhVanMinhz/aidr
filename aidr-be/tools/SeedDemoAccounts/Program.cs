using AIDR.Infrastructure.Auth;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;

var connectionString = args.Length > 0
    ? args[0]
    : @"Server=.\SQLEXPRESS;Database=AIDR;Trusted_Connection=True;TrustServerCertificate=True;";

var options = new DbContextOptionsBuilder<AidrDbContext>()
    .UseSqlServer(connectionString)
    .Options;

await using var db = new AidrDbContext(options);
var hasher = new AspNetPasswordHasher();

Console.WriteLine("Seeding demo accounts...");
var result = await DemoAccountsSeeder.SeedAsync(db, hasher);
Console.WriteLine(result.Password);
foreach (var account in result.Accounts)
    Console.WriteLine($"{account.Email}\t{account.Role}");
Console.WriteLine("Done.");
