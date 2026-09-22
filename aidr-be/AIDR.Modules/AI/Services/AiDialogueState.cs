namespace AIDR.Modules.AI.Services;

/// <summary>Discourse memory after product cards were shown - persisted in MetaJson.</summary>
public sealed class DialogueState
{
    public string? LastAct { get; set; }
    public Guid? FocusProductId { get; set; }
    public List<DialogueLastShownItem> LastShown { get; set; } = [];
    public List<Guid> CompareCandidateIds { get; set; } = [];
    public decimal? AnchorPrice { get; set; }
    public bool ExcludeShownOnNextSearch { get; set; }

    public DialogueState Clone() => new()
    {
        LastAct = LastAct,
        FocusProductId = FocusProductId,
        LastShown = LastShown.Select(x => x.Clone()).ToList(),
        CompareCandidateIds = [..CompareCandidateIds],
        AnchorPrice = AnchorPrice,
        ExcludeShownOnNextSearch = ExcludeShownOnNextSearch
    };
}

public sealed class DialogueLastShownItem
{
    public Guid ProductId { get; set; }
    public string? Badge { get; set; }
    public decimal Price { get; set; }
    public int Ordinal { get; set; }
    public decimal? AvgRating { get; set; }

    public DialogueLastShownItem Clone() => new()
    {
        ProductId = ProductId,
        Badge = Badge,
        Price = Price,
        Ordinal = Ordinal,
        AvgRating = AvgRating
    };
}
