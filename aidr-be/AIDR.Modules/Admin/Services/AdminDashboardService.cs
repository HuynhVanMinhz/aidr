using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminDashboardService : IAdminDashboardService
{
    private readonly IAdminDashboardRepository _repository;

    public AdminDashboardService(IAdminDashboardRepository repository) => _repository = repository;

    public Task<AdminDashboardDto> GetAsync(CancellationToken cancellationToken = default) =>
        _repository.GetKpisAsync(cancellationToken);
}
