namespace AIDR.Shared.Exceptions;

public class AppException : Exception
{
    public int StatusCode { get; }

    public AppException(string message, int statusCode = 400) : base(message)
    {
        StatusCode = statusCode;
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message, 404) { }
}

public class UnauthorizedAppException : AppException
{
    public UnauthorizedAppException(string message = "Unauthorized") : base(message, 401) { }
}

public class ConflictException : AppException
{
    public ConflictException(string message) : base(message, 409) { }
}

public class ForbiddenAppException : AppException
{
    public ForbiddenAppException(string message = "Forbidden") : base(message, 403) { }
}

/// <summary>
/// An upstream provider could not be reached, or refused us - as opposed to the
/// user's input being wrong. Callers may fall back to a manual path.
/// </summary>
public class ProviderUnavailableException : AppException
{
    public ProviderUnavailableException(string message) : base(message, 503) { }
}
