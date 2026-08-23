using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

namespace AIDR.Infrastructure.Caching;

public class RedisCacheService : ICacheService
{
    private readonly IDistributedCache _cache;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public RedisCacheService(IDistributedCache cache)
    {
        _cache = cache;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var bytes = await _cache.GetAsync(key, cancellationToken);
        if (bytes is null || bytes.Length == 0) return default;
        return JsonSerializer.Deserialize<T>(bytes, JsonOptions);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiry ?? TimeSpan.FromMinutes(5)
        };
        await _cache.SetAsync(key, bytes, options, cancellationToken);
    }

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
        => _cache.RemoveAsync(key, cancellationToken);
}
