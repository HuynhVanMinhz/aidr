FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY AIDR.sln ./
COPY AIDR.Api/AIDR.Api.csproj AIDR.Api/
COPY AIDR.Shared/AIDR.Shared.csproj AIDR.Shared/
COPY AIDR.Modules/AIDR.Modules.csproj AIDR.Modules/
COPY AIDR.Infrastructure/AIDR.Infrastructure.csproj AIDR.Infrastructure/
RUN dotnet restore AIDR.Api/AIDR.Api.csproj
COPY . .
RUN dotnet publish AIDR.Api/AIDR.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AIDR.Api.dll"]
