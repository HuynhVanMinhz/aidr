namespace AIDR.Shared.Constants;

public static class KycConstants
{
    public const string ProviderFptAi = "FPTAI";
    public const string ProviderGemini = "GEMINI";

    /// <summary>Stamped on records produced by the local mock, never by a real check.</summary>
    public const string ProviderMock = "MOCK";

    /// <summary>
    /// The automated check never ran (provider down or unauthorised) — a human
    /// has to read the documents. Never an automatic pass.
    /// </summary>
    public const string ProviderManual = "MANUAL";

    public const string StatusPending = "Pending";
    public const string StatusPassed = "Passed";
    public const string StatusManualReview = "ManualReview";
    public const string StatusFailed = "Failed";

    public const string DocumentTypeCccd = "CCCD";
    public const string DocumentTypeCmnd = "CMND";

    public const int MaxImageUrlLength = 512;

    /// <summary>Passed or ManualReview: enough to open a seller application.</summary>
    public static readonly HashSet<string> UsableStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusPassed,
        StatusManualReview
    };
}

public static class SellerRegistrationConstants
{
    public const string StatusPending = "Pending";
    public const string StatusApproved = "Approved";
    public const string StatusRejected = "Rejected";
    public const string StatusNeedsMoreInfo = "NeedsMoreInfo";

    public const string BusinessTypeIndividual = "Individual";
    public const string BusinessTypeHousehold = "Household";
    public const string BusinessTypeCompany = "Company";

    public const int MaxTaxCodeLength = 32;
    public const int MaxBusinessAddressLength = 300;
    public const int MaxContactPhoneLength = 20;
    public const int MaxContactEmailLength = 256;

    public static readonly HashSet<string> BusinessTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        BusinessTypeIndividual,
        BusinessTypeHousehold,
        BusinessTypeCompany
    };

    /// <summary>These need a tax code and a business licence scan.</summary>
    public static readonly HashSet<string> RegisteredBusinessTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        BusinessTypeHousehold,
        BusinessTypeCompany
    };

    /// <summary>Statuses the applicant may edit and resubmit from.</summary>
    public static readonly HashSet<string> EditableStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusNeedsMoreInfo,
        StatusRejected
    };
}
