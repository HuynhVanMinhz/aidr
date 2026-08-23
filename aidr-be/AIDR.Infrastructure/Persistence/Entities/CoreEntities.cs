namespace AIDR.Infrastructure.Persistence.Entities;

public class Role
{
    public int RoleId { get; set; }
    public string RoleCode { get; set; } = null!;
    public string RoleName { get; set; } = null!;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public class User
{
    public Guid UserId { get; set; }
    public string? KeycloakSub { get; set; }
    public string Email { get; set; } = null!;
    public bool EmailConfirmed { get; set; }
    public string? PasswordHash { get; set; }
    public string FullName { get; set; } = null!;
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public string Status { get; set; } = "Active";
    public int FailedLoginCount { get; set; }
    public DateTime? LockoutUntil { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public class UserRole
{
    public Guid UserId { get; set; }
    public int RoleId { get; set; }
    public DateTime AssignedAt { get; set; }

    public User User { get; set; } = null!;
    public Role Role { get; set; } = null!;
}

public class Category
{
    public int CategoryId { get; set; }
    public int? ParentId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Shop
{
    public Guid ShopId { get; set; }
    public Guid OwnerUserId { get; set; }
    public string ShopName { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? Tagline { get; set; }
    public string? ShortDescription { get; set; }
    public string CostingMethod { get; set; } = "FIFO";
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Product
{
    public Guid ProductId { get; set; }
    public Guid ShopId { get; set; }
    public int CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? ShortDescription { get; set; }
    public decimal BasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public decimal? LastCostPrice { get; set; }
    public decimal? AvgCostPrice { get; set; }
    public int StockQuantity { get; set; }
    public int ReservedQuantity { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Shop Shop { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
