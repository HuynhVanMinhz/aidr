using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class ProductQaRepository : IProductQaRepository
{
    private readonly AidrDbContext _db;

    public ProductQaRepository(AidrDbContext db) => _db = db;

    public Task<bool> ProductIsQaEnabledAsync(Guid productId, CancellationToken cancellationToken = default)
        => _db.Products.AsNoTracking()
            .AnyAsync(
                p => p.ProductId == productId && p.Status == OrderConstants.ApprovedProductStatus,
                cancellationToken);

    public async Task<ProductQuestionListResult> ListVisibleAsync(
        Guid productId,
        int page,
        int pageSize,
        Guid? viewerUserId,
        CancellationToken cancellationToken = default)
    {
        var query = _db.ProductQuestions.AsNoTracking()
            .Where(q => q.ProductId == productId && q.Status == ProductQaConstants.StatusVisible);

        var totalCount = await query.CountAsync(cancellationToken);

        var questionRows = await query
            .OrderByDescending(q => q.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(q => new
            {
                q.QuestionId,
                q.ProductId,
                q.UserId,
                q.Content,
                q.Status,
                q.CreatedAt,
                UserName = q.User.FullName,
                UserAvatarUrl = q.User.AvatarUrl,
                ShopOwnerUserId = q.Product.Shop.OwnerUserId
            })
            .ToListAsync(cancellationToken);

        var questionIds = questionRows.Select(q => q.QuestionId).ToList();
        var answers = questionIds.Count == 0
            ? new List<(Guid QuestionId, ProductAnswerDto Dto)>()
            : (await _db.ProductAnswers.AsNoTracking()
                .Where(a => questionIds.Contains(a.QuestionId))
                .OrderBy(a => a.CreatedAt)
                .Select(a => new
                {
                    a.QuestionId,
                    Dto = new ProductAnswerDto
                    {
                        AnswerId = a.AnswerId,
                        QuestionId = a.QuestionId,
                        UserId = a.UserId,
                        UserName = a.User.FullName,
                        UserAvatarUrl = a.User.AvatarUrl,
                        Content = a.Content,
                        IsOfficial = a.IsOfficial,
                        IsOwn = viewerUserId.HasValue && a.UserId == viewerUserId.Value,
                        CreatedAt = a.CreatedAt
                    }
                })
                .ToListAsync(cancellationToken))
                .Select(x => (x.QuestionId, x.Dto))
                .ToList();

        var answersByQuestion = answers
            .GroupBy(x => x.QuestionId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Dto).ToList());

        var items = questionRows.Select(q => new ProductQuestionDto
        {
            QuestionId = q.QuestionId,
            ProductId = q.ProductId,
            UserId = q.UserId,
            UserName = q.UserName,
            UserAvatarUrl = q.UserAvatarUrl,
            Content = q.Content,
            Status = q.Status,
            IsOwn = viewerUserId.HasValue && q.UserId == viewerUserId.Value,
            CanHide = viewerUserId.HasValue && q.ShopOwnerUserId == viewerUserId.Value,
            CreatedAt = q.CreatedAt,
            Answers = answersByQuestion.TryGetValue(q.QuestionId, out var questionAnswers)
                ? questionAnswers
                : (IReadOnlyList<ProductAnswerDto>)Array.Empty<ProductAnswerDto>()
        }).ToList();

        return new ProductQuestionListResult
        {
            ProductId = productId,
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<ProductQuestionDto> CreateQuestionAsync(
        Guid userId,
        Guid productId,
        string content,
        CancellationToken cancellationToken = default)
    {
        var product = await _db.Products.AsNoTracking()
            .Where(p => p.ProductId == productId)
            .Select(p => new { p.ProductId, p.Status, OwnerUserId = p.Shop.OwnerUserId })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (!string.Equals(product.Status, OrderConstants.ApprovedProductStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Questions can only be asked on approved products.");

        var entity = new ProductQuestion
        {
            QuestionId = Guid.NewGuid(),
            ProductId = productId,
            UserId = userId,
            Content = content,
            Status = ProductQaConstants.StatusVisible,
            CreatedAt = DateTime.UtcNow
        };

        _db.ProductQuestions.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        var user = await _db.Users.AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => new { u.FullName, u.AvatarUrl })
            .FirstAsync(cancellationToken);

        return new ProductQuestionDto
        {
            QuestionId = entity.QuestionId,
            ProductId = entity.ProductId,
            UserId = entity.UserId,
            UserName = user.FullName,
            UserAvatarUrl = user.AvatarUrl,
            Content = entity.Content,
            Status = entity.Status,
            IsOwn = true,
            CanHide = product.OwnerUserId == userId,
            CreatedAt = entity.CreatedAt,
            Answers = Array.Empty<ProductAnswerDto>()
        };
    }

    public async Task<ProductAnswerDto> CreateAnswerAsync(
        Guid userId,
        Guid questionId,
        string content,
        CancellationToken cancellationToken = default)
    {
        var question = await _db.ProductQuestions
            .Include(q => q.Product)
                .ThenInclude(p => p.Shop)
            .FirstOrDefaultAsync(q => q.QuestionId == questionId, cancellationToken)
            ?? throw new NotFoundException("Question not found.");

        if (!string.Equals(question.Status, ProductQaConstants.StatusVisible, StringComparison.OrdinalIgnoreCase))
            throw new AppException("This question is no longer visible.");

        var isShopOwner = question.Product.Shop.OwnerUserId == userId;
        var hasPurchased = isShopOwner || await HasCompletedPurchaseAsync(userId, question.ProductId, cancellationToken);

        if (!hasPurchased)
            throw new AppException("Only the shop owner or buyers who purchased this product can answer.");

        var entity = new ProductAnswer
        {
            AnswerId = Guid.NewGuid(),
            QuestionId = questionId,
            UserId = userId,
            Content = content,
            IsOfficial = isShopOwner,
            CreatedAt = DateTime.UtcNow
        };

        _db.ProductAnswers.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        var user = await _db.Users.AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => new { u.FullName, u.AvatarUrl })
            .FirstAsync(cancellationToken);

        return new ProductAnswerDto
        {
            AnswerId = entity.AnswerId,
            QuestionId = entity.QuestionId,
            UserId = entity.UserId,
            UserName = user.FullName,
            UserAvatarUrl = user.AvatarUrl,
            Content = entity.Content,
            IsOfficial = entity.IsOfficial,
            IsOwn = true,
            CreatedAt = entity.CreatedAt
        };
    }

    public async Task<ProductQuestionDto> HideQuestionAsync(
        Guid shopOwnerUserId,
        Guid questionId,
        CancellationToken cancellationToken = default)
    {
        var question = await _db.ProductQuestions
            .Include(q => q.Product)
                .ThenInclude(p => p.Shop)
            .Include(q => q.User)
            .FirstOrDefaultAsync(q => q.QuestionId == questionId, cancellationToken)
            ?? throw new NotFoundException("Question not found.");

        if (question.Product.Shop.OwnerUserId != shopOwnerUserId)
            throw new AppException("Only the shop owner can hide questions.");

        question.Status = ProductQaConstants.StatusHidden;
        await _db.SaveChangesAsync(cancellationToken);

        return new ProductQuestionDto
        {
            QuestionId = question.QuestionId,
            ProductId = question.ProductId,
            UserId = question.UserId,
            UserName = question.User.FullName,
            UserAvatarUrl = question.User.AvatarUrl,
            Content = question.Content,
            Status = question.Status,
            IsOwn = question.UserId == shopOwnerUserId,
            CanHide = true,
            CreatedAt = question.CreatedAt,
            Answers = Array.Empty<ProductAnswerDto>()
        };
    }

    public Task<bool> HasCompletedPurchaseAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default)
        => _db.OrderItems.AsNoTracking()
            .AnyAsync(
                i => i.ProductId == productId
                     && i.Order.BuyerUserId == userId
                     && i.Order.Status == OrderConstants.StatusCompleted,
                cancellationToken);
}
