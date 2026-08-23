namespace AIDR.Shared.Results;

public class ApiResult<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public IReadOnlyList<string>? Errors { get; init; }

    public static ApiResult<T> Ok(T data, string? message = null) => new()
    {
        Success = true,
        Data = data,
        Message = message
    };

    public static ApiResult<T> Fail(string message, IEnumerable<string>? errors = null) => new()
    {
        Success = false,
        Message = message,
        Errors = errors?.ToList()
    };
}
