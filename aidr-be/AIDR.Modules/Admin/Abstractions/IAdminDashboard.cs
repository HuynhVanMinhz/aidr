using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public interface IAdminDashboardRepository
{
    Task<AdminDashboardDto> GetKpisAsync(CancellationToken cancellationToken = default);
}

public interface IAdminDashboardService
{
    Task<AdminDashboardDto> GetAsync(CancellationToken cancellationToken = default);
}
