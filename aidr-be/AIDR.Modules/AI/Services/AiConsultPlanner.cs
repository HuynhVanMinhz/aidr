using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;

namespace AIDR.Modules.AI.Services;

/// <summary>Preference filters remembered across turns of one conversation.</summary>
public sealed class SlotState
{
    public string? Q { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string? Brand { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public decimal? MinRating { get; set; }
    public string? Sort { get; set; }
}

/// <summary>Guided-consultation progress, persisted in <c>AiMessages.MetaJson</c>.</summary>
public sealed class ConsultState
{
    public int RoundId { get; set; } = 1;

    /// <summary>collecting | ready | presented</summary>
    public string Stage { get; set; } = AiConstants.ConsultStageCollecting;

    /// <summary>Questions asked this round - never exceeds <see cref="AiConstants.MaxConsultQuestions"/>.</summary>
    public int AskedCount { get; set; }

    public List<string> Asked { get; set; } = [];

    /// <summary>Question awaiting an answer, kept across an interruption.</summary>
    public string? PendingQuestion { get; set; }

    public Dictionary<string, string> Answers { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Human-readable notes about filters relaxed to find results.</summary>
    public List<string> Relaxed { get; set; } = [];

    /// <summary>Products already presented this round, so "other options" shows new ones.</summary>
    public List<Guid> ShownIds { get; set; } = [];

    public bool Skipped { get; set; }

    public ConsultState CloneForNewRound(bool keepBudget)
    {
        var next = new ConsultState
        {
            RoundId = RoundId + 1,
            Stage = AiConstants.ConsultStageCollecting
        };

        // Budget is a property of the person, not of the product category.
        if (keepBudget && Answers.TryGetValue(AiConstants.ConsultQuestionBudget, out var budget))
            next.Answers[AiConstants.ConsultQuestionBudget] = budget;

        return next;
    }
}

public sealed class ConsultDecision
{
    public bool ShouldAsk { get; init; }

    public ConsultQuestion? Question { get; init; }

    public ConsultState State { get; init; } = new();

    /// <summary>Set when a topic switch started a fresh round - caller clears category-bound slots.</summary>
    public bool RoundReset { get; init; }
}

public sealed class ConsultPlanInput
{
    public ConsultState? Previous { get; init; }
    public SlotState Slots { get; init; } = new();
    public bool SkipRequested { get; init; }
    public bool CategoryChanged { get; init; }
    public bool FocusedOnProduct { get; init; }

    /// <summary>Approved products matching the current hard filters.</summary>
    public int CandidateCount { get; init; }

    public string? Group { get; init; }
    public AiPriceBands Bands { get; init; } = AiPriceBands.Empty;
    public IReadOnlyList<AiCategoryLookup> Categories { get; init; } = Array.Empty<AiCategoryLookup>();
}

/// <summary>
/// Decides whether the assistant should ask one more consultation question or recommend now.
/// Pure and deterministic - the caller supplies catalog counts and price bands.
/// </summary>
public static class AiConsultPlanner
{
    private static readonly string[] AskOrder =
    [
        AiConstants.ConsultQuestionCategory,
        // Use case before budget: narrowing to "gaming laptops" makes the budget chips
        // reflect that shelf's real prices instead of the whole category's.
        AiConstants.ConsultQuestionUseCase,
        AiConstants.ConsultQuestionBudget,
        AiConstants.ConsultQuestionPriority
    ];

    /// <summary>Intents where a guided consultation makes sense at all.</summary>
    public static bool IsEligibleIntent(string intent)
        => intent is AiConstants.IntentRecommend
            or AiConstants.IntentRefine
            or AiConstants.IntentClarify
            or AiConstants.IntentBrowse;

    /// <summary>Cheap predicate so the caller only pays for price bands when they may be asked.</summary>
    public static bool MayAskBudget(ConsultState? state, SlotState slots)
        => !IsFilled(AiConstants.ConsultQuestionBudget, slots, state, null)
           && state?.Asked.Contains(AiConstants.ConsultQuestionBudget) != true
           && (state?.AskedCount ?? 0) < AiConstants.MaxConsultQuestions;

    public static ConsultDecision Plan(ConsultPlanInput input)
    {
        var reset = false;
        var state = input.Previous;

        // R2 - topic switch starts a fresh round but keeps the buyer's budget.
        if (state is not null && input.CategoryChanged)
        {
            state = state.CloneForNewRound(keepBudget: true);
            reset = true;
        }

        state ??= new ConsultState();

        // R0 - the buyer is looking at one product; do not interrogate them.
        if (input.FocusedOnProduct)
            return Present(state);

        // R0b - this round already produced recommendations. Follow-ups refine them;
        // only a topic switch (handled above) may start asking again.
        if (string.Equals(state.Stage, AiConstants.ConsultStagePresented, StringComparison.Ordinal))
            return Present(state, reset);

        // R1 - explicit escape hatch.
        if (input.SkipRequested)
        {
            state.Skipped = true;
            return Present(state, reset);
        }

        // R3 - question budget spent.
        if (state.AskedCount >= AiConstants.MaxConsultQuestions)
            return Present(state, reset);

        // R4 - hard filters already narrow enough that another question cannot pay for itself.
        if (input.Slots.CategoryId is not null
            && IsFilled(AiConstants.ConsultQuestionBudget, input.Slots, state, input.Group)
            && input.CandidateCount <= AiConstants.EarlyPresentThreshold)
            return Present(state, reset);

        // R5 - nothing left to narrow.
        if (input.CandidateCount <= AiConstants.MinCandidatesToStopAsking)
            return Present(state, reset);

        // R6 - ask the highest-value question still missing.
        foreach (var key in AskOrder)
        {
            if (IsFilled(key, input.Slots, state, input.Group))
                continue;
            if (state.Asked.Contains(key, StringComparer.OrdinalIgnoreCase))
                continue;

            var question = BuildQuestion(key, input);
            if (question is null)
                continue;

            state.Stage = AiConstants.ConsultStageCollecting;
            state.AskedCount++;
            state.Asked.Add(key);
            state.PendingQuestion = key;

            return new ConsultDecision
            {
                ShouldAsk = true,
                Question = question,
                State = state,
                RoundReset = reset
            };
        }

        return Present(state, reset);
    }

    private static ConsultQuestion? BuildQuestion(string key, ConsultPlanInput input)
        => key switch
        {
            AiConstants.ConsultQuestionCategory =>
                AiConsultQuestionBank.BuildCategoryQuestion(input.Categories),
            AiConstants.ConsultQuestionUseCase =>
                AiConsultQuestionBank.BuildUseCaseQuestion(input.Group),
            AiConstants.ConsultQuestionBudget =>
                AiConsultQuestionBank.BuildBudgetQuestion(input.Bands),
            AiConstants.ConsultQuestionPriority =>
                AiConsultQuestionBank.BuildPriorityQuestion(input.Group),
            _ => null
        };

    private static ConsultDecision Present(ConsultState state, bool reset = false)
    {
        state.Stage = AiConstants.ConsultStagePresented;
        state.PendingQuestion = null;
        return new ConsultDecision { ShouldAsk = false, State = state, RoundReset = reset };
    }

    /// <summary>A slot counts as filled from the buyer's own words as well as from a chip.</summary>
    public static bool IsFilled(string key, SlotState slots, ConsultState? state, string? group)
    {
        if (state is not null
            && state.Answers.TryGetValue(key, out var answer)
            && !string.IsNullOrWhiteSpace(answer))
            return true;

        return key switch
        {
            AiConstants.ConsultQuestionCategory => slots.CategoryId is not null,
            AiConstants.ConsultQuestionBudget => slots.MinPrice is not null || slots.MaxPrice is not null,
            // Only free text that really names a use case counts - not NL leftovers like "buy".
            AiConstants.ConsultQuestionUseCase => AiConsultQuestionBank.MentionsUseCase(slots.Q, group),
            AiConstants.ConsultQuestionPriority =>
                !string.IsNullOrWhiteSpace(slots.Sort) || slots.MinRating is not null,
            _ => false
        };
    }

    /// <summary>Chips for the widget, in the wire format the request echoes back.</summary>
    public static IReadOnlyList<AiQuickReplyDto> ToQuickReplies(ConsultQuestion question)
        => question.Choices
            .Select(c => new AiQuickReplyDto
            {
                Key = question.Key,
                Label = c.Label,
                Value = AiConsultQuestionBank.ToWireValue(question.Key, c)
            })
            .ToList();

    public static AiConsultStateDto ToDto(ConsultState state)
        => new()
        {
            Stage = state.Stage,
            AskedCount = state.AskedCount,
            MaxQuestions = AiConstants.MaxConsultQuestions,
            PendingQuestion = state.PendingQuestion
        };
}
